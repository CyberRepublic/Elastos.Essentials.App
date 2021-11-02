import { MAINNET_TEMPLATE, TESTNET_TEMPLATE } from "src/app/services/global.networks.service";

export enum TelosAPIType {
  ACCOUNT_RPC,
  RPC
}

// Block explorer: https://rpc1.us.telos.net/v2/explore
// Testnet faucet: https://app.telos.net/testnet/developers
// Testnet explorer: http://testnet.telos.net/v2/explore/
export class TelosAPI {
  public static getApiUrl(type: TelosAPIType, networkTemplate: string): string {
    switch (networkTemplate) {
      case MAINNET_TEMPLATE:
        switch (type) {
          case TelosAPIType.RPC: return 'https://mainnet.telos.net/evm';
          case TelosAPIType.ACCOUNT_RPC: return 'NOT_SUPPORTED_YET';
          default:
            throw new Error("Telos API - Unknown api type " + type);
        }
      case TESTNET_TEMPLATE:
        switch (type) {
          case TelosAPIType.RPC: return 'https://testnet.telos.net/evm';
          case TelosAPIType.ACCOUNT_RPC: return 'NOT_SUPPORTED_YET';
          default:
            throw new Error("Telos API - Unknown api type " + type);
        }
      default:
        throw new Error("Telos API not supported for network template " + networkTemplate);
    }
  }
}