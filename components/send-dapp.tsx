"use client"

import { useCallback, useEffect, useState } from "react"
import { BrowserProvider, formatEther, isAddress, parseEther } from "ethers"
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_PARAMS,
  explorerAddressUrl,
  explorerTxUrl,
  shortenAddress,
} from "@/lib/ethereum"

type TxState =
  | { status: "idle" }
  | { status: "pending"; hash?: string }
  | { status: "confirmed"; hash: string }
  | { status: "error"; message: string }

export function SendDapp() {
  const [hasWallet, setHasWallet] = useState(true)
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [tx, setTx] = useState<TxState>({ status: "idle" })

  const onSepolia = chainId === SEPOLIA_CHAIN_ID

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum)
  }, [])

  const refreshBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return
    try {
      const provider = new BrowserProvider(window.ethereum)
      const bal = await provider.getBalance(address)
      setBalance(formatEther(bal))
    } catch {
      setBalance(null)
    }
  }, [])

  const syncChain = useCallback(async () => {
    if (!window.ethereum) return
    try {
      const id = (await window.ethereum.request({ method: "eth_chainId" })) as string
      setChainId(id)
    } catch {
      /* ignore */
    }
  }, [])

  // Restore existing connection + subscribe to wallet events
  useEffect(() => {
    if (!window.ethereum) return

    const init = async () => {
      try {
        const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[]
        if (accounts.length > 0) {
          setAccount(accounts[0])
          refreshBalance(accounts[0])
        }
        syncChain()
      } catch {
        /* ignore */
      }
    }
    init()

    const handleAccounts = (accounts: string[]) => {
      setAccount(accounts[0] ?? null)
      if (accounts[0]) refreshBalance(accounts[0])
      else setBalance(null)
    }
    const handleChain = (id: string) => {
      setChainId(id)
      if (account) refreshBalance(account)
    }

    window.ethereum.on?.("accountsChanged", handleAccounts)
    window.ethereum.on?.("chainChanged", handleChain)
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts)
      window.ethereum?.removeListener?.("chainChanged", handleChain)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshBalance, syncChain])

  const connect = async () => {
    if (!window.ethereum) return
    setConnecting(true)
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[]
      setAccount(accounts[0] ?? null)
      await syncChain()
      if (accounts[0]) refreshBalance(accounts[0])
    } catch (err: any) {
      setTx({ status: "error", message: err?.message ?? "Failed to connect wallet" })
    } finally {
      setConnecting(false)
    }
  }

  const switchToSepolia = async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      })
    } catch (err: any) {
      // 4902 = chain not added yet
      if (err?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SEPOLIA_PARAMS],
          })
        } catch {
          /* ignore */
        }
      }
    }
  }

  const recipientValid = recipient.length === 0 || isAddress(recipient)
  const amountNum = Number(amount)
  const amountValid =
    amount.length === 0 || (!Number.isNaN(amountNum) && amountNum > 0)
  const exceedsBalance =
    balance != null && amount.length > 0 && amountValid && amountNum > Number(balance)

  const canSend =
    !!account &&
    onSepolia &&
    isAddress(recipient) &&
    amountValid &&
    amount.length > 0 &&
    !exceedsBalance &&
    tx.status !== "pending"

  const send = async () => {
    if (!window.ethereum || !canSend) return
    setTx({ status: "pending" })
    try {
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const txResponse = await signer.sendTransaction({
        to: recipient,
        value: parseEther(amount),
      })
      setTx({ status: "pending", hash: txResponse.hash })
      await txResponse.wait()
      setTx({ status: "confirmed", hash: txResponse.hash })
      if (account) refreshBalance(account)
      setAmount("")
      setRecipient("")
    } catch (err: any) {
      const message =
        err?.code === "ACTION_REJECTED"
          ? "Transaction rejected in wallet"
          : err?.shortMessage ?? err?.message ?? "Transaction failed"
      setTx({ status: "error", message })
    }
  }

  return (
    <div className="w-full max-w-md">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M12 2L5 12.5l7 4 7-4L12 2z"
                fill="currentColor"
                opacity="0.9"
              />
              <path d="M12 17.5l-7-4L12 22l7-8.5-7 4z" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Sepolia Sender</h1>
            <p className="text-xs text-muted-foreground">Send testnet ETH</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${onSepolia ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {onSepolia ? "Sepolia" : "Wrong network"}
        </span>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {!hasWallet ? (
          <NoWallet />
        ) : !account ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to view your balance and send Sepolia ETH.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        ) : (
          <>
            {/* Account + balance */}
            <div className="mb-5 rounded-xl bg-secondary/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Connected account</span>
                <a
                  href={explorerAddressUrl(account)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-foreground underline-offset-2 hover:underline"
                >
                  {shortenAddress(account)}
                </a>
              </div>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground">Balance</span>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight">
                  {balance != null ? Number(balance).toFixed(4) : "—"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">SepoliaETH</span>
                </p>
              </div>
            </div>

            {!onSepolia && (
              <button
                onClick={switchToSepolia}
                className="mb-4 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
              >
                Switch to Sepolia network
              </button>
            )}

            {/* Send form */}
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="recipient" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Recipient address
                </label>
                <input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  className={`w-full rounded-xl border bg-background px-3.5 py-3 font-mono text-sm outline-none transition-colors placeholder:font-sans focus:ring-2 focus:ring-ring/50 ${
                    recipientValid ? "border-input" : "border-destructive"
                  }`}
                />
                {!recipientValid && (
                  <p className="mt-1.5 text-xs text-destructive">Enter a valid Ethereum address.</p>
                )}
              </div>

              <div>
                <label htmlFor="amount" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Amount (ETH)
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0.0"
                    className={`w-full rounded-xl border bg-background px-3.5 py-3 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/50 ${
                      amountValid && !exceedsBalance ? "border-input" : "border-destructive"
                    }`}
                  />
                  {balance != null && (
                    <button
                      type="button"
                      onClick={() => setAmount(balance)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:opacity-80"
                    >
                      Max
                    </button>
                  )}
                </div>
                {!amountValid && (
                  <p className="mt-1.5 text-xs text-destructive">Enter an amount greater than 0.</p>
                )}
                {exceedsBalance && (
                  <p className="mt-1.5 text-xs text-destructive">Amount exceeds your balance.</p>
                )}
              </div>

              <button
                onClick={send}
                disabled={!canSend}
                className="mt-1 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tx.status === "pending" ? "Sending…" : "Send ETH"}
              </button>
            </div>

            <TxStatus tx={tx} />
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Testnet only. Need funds? Use a{" "}
        <a
          href="https://sepoliafaucet.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Sepolia faucet
        </a>
        .
      </p>
    </div>
  )
}

function TxStatus({ tx }: { tx: TxState }) {
  if (tx.status === "idle") return null

  if (tx.status === "error") {
    return (
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {tx.message}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        {tx.status === "pending" ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        )}
        <span className="font-medium">
          {tx.status === "pending" ? "Transaction pending…" : "Transaction confirmed"}
        </span>
      </div>
      {tx.hash && (
        <a
          href={explorerTxUrl(tx.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block truncate font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {tx.hash}
        </a>
      )}
    </div>
  )
}

function NoWallet() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm font-medium">No Ethereum wallet detected</p>
      <p className="text-sm text-muted-foreground">
        Install a browser wallet like MetaMask to connect and send Sepolia ETH.
      </p>
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Get MetaMask
      </a>
    </div>
  )
}
