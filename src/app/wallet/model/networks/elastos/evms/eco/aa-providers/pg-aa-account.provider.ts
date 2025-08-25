import {
  lazyEthersContractImport,
  lazyEthersImport,
} from "src/app/helpers/import.helper";
import { Logger } from "src/app/logger";
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { WalletNetworkService } from "src/app/wallet/services/network.service";
import { AccountAbstractionProvider } from "../../../../evms/account-abstraction-provider";

/**
 * PG AA Account Provider for ECO chain
 * Implements Account Abstraction functionality specific to the PG implementation
 */
export class PGAAAccountProvider extends AccountAbstractionProvider {
  constructor() {
    super("PG AA Account", [
      {
        chainId: 12343,
        entryPointAddress: "0x1Cf34692a73D0edf3d01C5f991441D891469950a",
        bundlerRpcUrl: "https://rpc.eco.evm.testnet.elastos.io",
        paymasterAddress: "0xbc52c634Ed3174EA4293Ba63F8a28006f7c2a360",
        factoryAddress: "0xaC62d54D8ed6EedA5c78Aa2ec8c2324cF1081b97",
      },
    ]);
  }

  /**
   * Get the AA account address for a given EOA account on a specific chain
   * @param eoaAddress The EOA address
   * @param chainId The chain ID
   * @returns Promise resolving to the AA account address
   */
  async getAccountAddress(
    eoaAddress: string,
    chainId: number
  ): Promise<string> {
    Logger.log(
      "wallet",
      `PGAAAccountProvider: Getting AA account address for EOA ${eoaAddress} on chain ${chainId}`
    );

    // Check if chain is supported
    if (!this.supportsChain(chainId)) {
      return Promise.reject(
        new Error(`Chain ${chainId} is not supported by PG AA Account Provider`)
      );
    }

    try {
      // Get the chain configuration
      const chainConfig = this.supportedChains.find(
        (chain) => chain.chainId === chainId
      );

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ${chainId}`);
      }

      // Get the network instance
      const network =
        WalletNetworkService.instance.getNetworkByChainId(chainId);
      if (!network) {
        throw new Error(`Network not found for chain ${chainId}`);
      }

      // Get Web3 instance
      const web3 = await EVMService.instance.getWeb3(network);

      // Import ethers.js
      const { providers } = await lazyEthersImport();
      const Contract = await lazyEthersContractImport();

      // Create provider and signer
      const originalProvider = new providers.Web3Provider(web3.currentProvider);
      const originalSigner = originalProvider.getSigner();

      // Create contract instances
      const entryPoint = new Contract(
        chainConfig.entryPointAddress,
        [
          "function getSenderAddress(bytes calldata initCode) external view returns (address sender)",
        ],
        originalProvider
      );

      const factory = new Contract(
        chainConfig.factoryAddress,
        [
          "function createAccount(address owner, uint256 salt) external returns (address)",
        ],
        originalProvider
      );

      // Generate proper initCode: factory address + encoded function data
      const encodedFunctionData = factory.interface.encodeFunctionData(
        "createAccount",
        [
          eoaAddress,
          0, // salt
        ]
      );

      // initCode should be: factory address (20 bytes) + encoded function data
      const factoryAddressHex = chainConfig.factoryAddress.slice(2); // Remove 0x prefix
      const initCode = "0x" + factoryAddressHex + encodedFunctionData.slice(2);

      Logger.log("wallet", `PGAAAccountProvider: initCode: ${initCode}`);

      let senderAddress: string;
      try {
        senderAddress = await entryPoint.callStatic.getSenderAddress(initCode);
        Logger.log(
          "wallet",
          `PGAAAccountProvider: senderAddress from direct call: ${senderAddress}`
        );
      } catch (e: any) {
        Logger.log(
          "wallet",
          `PGAAAccountProvider: getSenderAddress error: ${e.message}`
        );
        if (e.errorArgs && e.errorArgs.sender) {
          senderAddress = e.errorArgs.sender;
          Logger.log(
            "wallet",
            `PGAAAccountProvider: senderAddress from error: ${senderAddress}`
          );
        } else {
          Logger.log(
            "wallet",
            `PGAAAccountProvider: No sender in error args, full error:`,
            e
          );
          throw e;
        }
      }

      Logger.log(
        "wallet",
        `PGAAAccountProvider: Final senderAddress: ${senderAddress}`
      );
      return senderAddress;
    } catch (error) {
      Logger.error(
        "wallet",
        `PGAAAccountProvider: Error getting AA account address:`,
        error
      );
      throw error;
    }
  }
}
