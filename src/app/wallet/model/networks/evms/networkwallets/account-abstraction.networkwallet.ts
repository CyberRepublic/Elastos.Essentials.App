import { Logger } from "src/app/logger";
import { LocalStorage } from "src/app/wallet/services/storage.service";
import { AccountAbstractionService } from "../../../../services/account-abstraction/account-abstraction.service";
import { WalletService } from "../../../../services/wallet.service";
import { AccountAbstractionMasterWallet } from "../../../masterwallets/account.abstraction.masterwallet";
import { WalletNetworkOptions } from "../../../masterwallets/wallet.types";
import { AddressUsage } from "../../../safes/addressusage";
import { Safe } from "../../../safes/safe";
import { WalletAddressInfo } from "../../base/networkwallets/networkwallet";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { AccountAbstractionProvider } from "../account-abstraction-provider";
import type { EVMNetwork } from "../evm.network";
import { AccountAbstractionSubWallet } from "../subwallets/account-abstraction.subwallet";
import { MainCoinEVMSubWallet } from "../subwallets/evm.subwallet";
import { AnyEVMNetworkWallet, EVMNetworkWallet } from "./evm.networkwallet";

/**
 * Network wallet type for Account Abstraction wallets on EVM networks
 */
export class AccountAbstractionNetworkWallet extends EVMNetworkWallet<
  AccountAbstractionMasterWallet,
  WalletNetworkOptions
> {
  // Store the AA provider and AA address
  protected aaProvider: AccountAbstractionProvider = null;
  protected aaAddress: string = null;

  constructor(
    masterWallet: AccountAbstractionMasterWallet,
    public network: EVMNetwork,
    safe: Safe,
    displayToken: string,
    mainSubWalletFriendlyName: string,
    public averageBlocktime = 5
  ) {
    super(masterWallet, network, safe, displayToken, mainSubWalletFriendlyName);
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
    this.mainTokenSubWallet = new AccountAbstractionSubWallet(
      this,
      this.masterWallet.id,
      this.mainSubWalletFriendlyName
    );

    // Add both subwallets
    this.subWallets[this.mainTokenSubWallet.id] = this.mainTokenSubWallet;

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
  public async prepareAccountAddress(): Promise<void> {
    // Use cached address if available
    this.aaAddress = await LocalStorage.instance.get(
      `aa-address-${this.aaProvider.id}-${this.masterWallet.id}`
    );
    if (this.aaAddress) {
      Logger.log(
        "wallet",
        "Using cached account abstraction address",
        this.aaAddress
      );
      return;
    }

    // If no cached address, fetch from the provider / AA contract
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

      // Save the address to local storage
      await LocalStorage.instance.set(
        `aa-address-${this.aaProvider.id}-${this.masterWallet.id}`,
        this.aaAddress
      );
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

  /**
   * Get the controller wallet that manages this AA wallet
   */
  public getControllerWalletId(): string {
    return this.masterWallet.getControllerWalletId();
  }
}
