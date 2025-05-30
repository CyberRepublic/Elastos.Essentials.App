
export enum EthereumAPIType {
  RPC,
  ETHERSCAN_API,
  BLOCK_EXPLORER
}

export class EthereumAPI {
  public static getApiUrl(type: EthereumAPIType, networkIdentifier: 'mainnet' | 'goerli'): string {
    switch (networkIdentifier) {
      case "mainnet":
        switch (type) {
          case EthereumAPIType.RPC: return 'https://eth.llamarpc.com';
          case EthereumAPIType.ETHERSCAN_API: return 'https://api.etherscan.io/v2/api';
          case EthereumAPIType.BLOCK_EXPLORER: return 'https://etherscan.io';
          default:
            throw new Error("Ethereum API - Unknown api type " + type);
        }
      case "goerli":
        switch (type) {
          case EthereumAPIType.RPC: return 'https://eth-goerli.public.blastapi.io';
          case EthereumAPIType.ETHERSCAN_API: return 'https://api-goerli.etherscan.io/api';
          case EthereumAPIType.BLOCK_EXPLORER: return 'https://goerli.etherscan.io';
          default:
            throw new Error("Ethereum API - Unknown api type " + type);
        }
      default:
        throw new Error("Ethereum API not supported for network identifier " + networkIdentifier);
    }
  }
}