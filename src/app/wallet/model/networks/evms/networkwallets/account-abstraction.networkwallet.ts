import { AccountAbstractionService } from "../../../../services/account-abstraction/account-abstraction.service";
import { AccountAbstractionMasterWallet } from "../../../masterwallets/account.abstraction.masterwallet";
import { WalletNetworkOptions } from "../../../masterwallets/wallet.types";
import { AddressUsage } from "../../../safes/addressusage";
import { Safe } from "../../../safes/safe";
import { WalletAddressInfo } from "../../base/networkwallets/networkwallet";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { AccountAbstractionProvider } from "../account-abstraction-provider";
import type { EVMNetwork } from "../evm.network";
import { AASafe } from "../safes/aa.safe";
import { AccountAbstractionSubWallet } from "../subwallets/account-abstraction.subwallet";
import { MainCoinEVMSubWallet } from "../subwallets/evm.subwallet";
import { EVMNetworkWallet } from "./evm.networkwallet";

/**
 * Network wallet type for Account Abstraction wallets on EVM networks
 */
export class AccountAbstractionNetworkWallet extends EVMNetworkWallet<
  AccountAbstractionMasterWallet,
  WalletNetworkOptions
> {
  // Store the AA provider and AA address
  protected aaProvider: AccountAbstractionProvider = null;

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
    const safe = this.safe as AASafe;
    const addresses: WalletAddressInfo[] = [
      {
        title: "EVM",
        address: safe.getAddresses(0, 1, false, AddressUsage.DEFAULT)[0],
      },
    ];

    return addresses;
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
