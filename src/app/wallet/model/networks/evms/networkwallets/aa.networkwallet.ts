import { EVMService } from "src/app/wallet/services/evm/evm.service";
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
import type { EVMNetwork } from "../evm.network";
import { AASafe } from "../safes/aa.safe";
import { AASubWallet } from "../subwallets/aa.subwallet";
import { MainCoinEVMSubWallet } from "../subwallets/evm.subwallet";

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
        address: this.mainTokenSubWallet.getAccountAddress(),
      },
    ];

    // Add AA contract address if deployed
    const aaSafe = this.safe as AASafe;
    if (aaSafe && aaSafe.isDeployed(this.network.key)) {
      addresses.push({
        title: "AA Contract",
        address: aaSafe.getDeployedAddress(this.network.key),
      });
    }

    return addresses;
  }

  /**
   * Get the deployed AA account address for this network
   */
  public getDeployedAAAddress(): string | null {
    const aaSafe = this.safe as AASafe;
    return aaSafe ? aaSafe.getDeployedAddress(this.network.key) : null;
  }

  /**
   * Check if this AA wallet is deployed on the current network
   */
  public isWalletDeployed(): boolean {
    const aaSafe = this.safe as AASafe;
    return aaSafe ? aaSafe.isDeployed(this.network.key) : false;
  }

  /**
   * Update the deployed address after deployment
   */
  public async updateDeployedAddress(
    deployedAddress: string,
    implementationAddress?: string,
    deploymentTxHash?: string
  ): Promise<void> {
    const aaSafe = this.safe as AASafe;
    if (aaSafe) {
      await aaSafe.updateDeployedAddress(
        this.network.key,
        deployedAddress,
        implementationAddress,
        deploymentTxHash
      );
    }
  }

  public async convertAddressForUsage(
    address: string,
    usage: AddressUsage
  ): Promise<string> {
    return await (address.startsWith("0x") ? address : "0x" + address);
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
