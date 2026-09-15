import type { Eip1193Provider } from "ethers"

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: any[]) => void) => void
      removeListener?: (event: string, handler: (...args: any[]) => void) => void
      isMetaMask?: boolean
    }
  }
}

// Sepolia testnet
export const SEPOLIA_CHAIN_ID = "0xaa36a7" // 11155111
export const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia Testnet",
  nativeCurrency: { name: "Sepolia Ether", symbol: "SepoliaETH", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
}

export function shortenAddress(address: string, chars = 4) {
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function explorerTxUrl(hash: string) {
  return `https://sepolia.etherscan.io/tx/${hash}`
}

export function explorerAddressUrl(address: string) {
  return `https://sepolia.etherscan.io/address/${address}`
}
