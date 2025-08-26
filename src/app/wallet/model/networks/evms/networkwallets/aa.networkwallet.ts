import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { AccountAbstractionService } from "../../../../services/account-abstraction/account-abstraction.service";
import { WalletService } from "../../../../services/wallet.service";
import { ExtendedTransactionInfo } from "../../../extendedtxinfo";
import { AccountAbstractionMasterWallet } from "../../../masterwallets/account.abstraction.masterwallet";
import { WalletNetworkOptions } from "../../../masterwallets/wallet.types";
import { AddressUsage } from "../../../safes/addressusage";
import { Safe } from "../../../safes/safe";
import {
  NetworkWallet,
  WalletAddressInfo,
} from "../../base/networkwallets/networkwallet";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { AccountAbstractionProvider } from "../account-abstraction-provider";
import type { EVMNetwork } from "../evm.network";
import { AASubWallet } from "../subwallets/aa.subwallet";
import { MainCoinEVMSubWallet } from "../subwallets/evm.subwallet";
import { AnyEVMNetworkWallet } from "./evm.networkwallet";

/**
 * Network wallet type for Account Abstraction wallets on EVM networks
 */
export class AANetworkWallet extends NetworkWallet<
  AccountAbstractionMasterWallet,
  WalletNetworkOptions
> {
  protected mainTokenSubWallet: MainCoinEVMSubWallet<WalletNetworkOptions> =
    null;
  protected aaSubWallet: AASubWallet<WalletNetworkOptions> = null;

  // Store the AA provider and AA address
  protected aaProvider: AccountAbstractionProvider = null;
  protected aaAddress: string = null;

  constructor(
    masterWallet: AccountAbstractionMasterWallet,
    public network: EVMNetwork,
    safe: Safe,
    displayToken: string,
    public mainSubWalletFriendlyName: string,
    public averageBlocktime = 5
  ) {
    super(masterWallet, network, safe, displayToken);
  }

  public async initialize(): Promise<void> {
    await super.initialize();

    // Initialize the AA provider and save as variable
    this.aaProvider = AccountAbstractionService.instance.getProviderById(
      this.masterWallet.getAAProviderId()
    );

    // Prepare and save the AA account address
    await this.prepareAccountAddress();
  }

  protected createTransactionDiscoveryProvider(): any {
    // TODO: Implement AA-specific transaction discovery
    return null;
  }

  protected async prepareStandardSubWallets(): Promise<void> {
    // Create the main token subwallet (ETH, BSC, etc.)
    this.mainTokenSubWallet = new MainCoinEVMSubWallet(
      this as any, // Cast to satisfy type requirements
      this.masterWallet.id,
      this.mainSubWalletFriendlyName
    );

    // Create the AA subwallet
    this.aaSubWallet = new AASubWallet(
      this as any, // Cast to satisfy type requirements
      this.masterWallet.id,
      "Account Abstraction"
    );

    // Add both subwallets
    this.subWallets[this.mainTokenSubWallet.id] = this.mainTokenSubWallet;
    this.subWallets[this.aaSubWallet.id] = this.aaSubWallet;

    return await void 0;
  }

  public getAddresses(): WalletAddressInfo[] {
    const addresses: WalletAddressInfo[] = [
      {
        title: "EVM",
        address: this.aaAddress,
      },
    ];

    return addresses;
  }

  /**
   * Prepares and saves the AA account address for this network using the AA provider.
   * Returns the address if successful, null otherwise.
   */
  public async prepareAccountAddress(): Promise<string | null> {
    try {
      if (!this.aaProvider) {
        this.aaProvider = AccountAbstractionService.instance.getProviderById(
          this.masterWallet.getAAProviderId()
        );
      }

      if (!this.aaProvider) {
        throw new Error(
          `Account abstraction provider with id ${this.masterWallet.getAAProviderId()} was not found for network wallet ${
            this.id
          }`
        );
      }

      // Get the controller wallet address
      const controllerWallet = WalletService.instance.getMasterWallet(
        this.masterWallet.getControllerWalletId()
      );

      if (!controllerWallet) {
        throw new Error(
          `Controller wallet with id ${this.masterWallet.getControllerWalletId()} was not found for account abstraction network wallet ${
            this.id
          }`
        );
      }

      // Get the controller's address on this network
      const controllerNetworkWallet = (await this.network.createNetworkWallet(
        controllerWallet,
        false
      )) as AnyEVMNetworkWallet;

      if (!controllerNetworkWallet) {
        throw new Error(
          `Unable to get controller network wallet for account abstraction network wallet ${
            this.id
          } and controller wallet ${this.masterWallet.getControllerWalletId()}`
        );
      }

      const controllerAddress =
        controllerNetworkWallet.getAddresses()[0].address;

      // TODO: SAVE AND LOAD ADDRESS, DONT FETCH FROM API EVERY TIME

      // Get the AA address from the provider and save it
      this.aaAddress = await this.aaProvider.getAccountAddress(
        controllerAddress,
        this.network.getMainChainID()
      );
      return this.aaAddress;
    } catch (error) {
      console.error("Error getting AA address:", error);
      this.aaAddress = null;
      return null;
    }
  }

  public async convertAddressForUsage(
    address: string,
    usage: AddressUsage
  ): Promise<string> {
    return (await address.startsWith("0x")) ? address : "0x" + address;
  }

  public getMainEvmSubWallet(): MainCoinEVMSubWallet<WalletNetworkOptions> {
    return this.mainTokenSubWallet;
  }

  public getMainTokenSubWallet(): AnySubWallet {
    return this.mainTokenSubWallet;
  }

  public getAASubWallet(): AASubWallet<WalletNetworkOptions> {
    return this.aaSubWallet;
  }

  public getDisplayTokenName(): string {
    return this.displayToken;
  }

  public getAverageBlocktime(): number {
    return this.averageBlocktime;
  }

  protected async fetchExtendedTxInfo(
    txHash: string
  ): Promise<ExtendedTransactionInfo> {
    // Fetch transaction receipt
    let receipt = await EVMService.instance.getTransactionReceipt(
      this.network,
      txHash
    );
    if (!receipt) return;

    // Save extended info to cache
    if (receipt) {
      await this.saveExtendedTxInfo(txHash, {
        evm: {
          transactionReceipt: receipt,
        },
      });
    }
  }

  /**
   * Get the controller wallet that manages this AA wallet
   */
  public getControllerWalletId(): string {
    return this.masterWallet.getControllerWalletId();
  }
}
