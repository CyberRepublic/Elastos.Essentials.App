import { AccountAbstractionTransaction } from 'src/app/wallet/services/account-abstraction/model/account-abstraction-transaction';
import { OutgoingTransactionState, TransactionService } from 'src/app/wallet/services/transaction.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { AccountAbstractionProvidersService } from '../../../../services/account-abstraction/account-abstraction-providers.service';
import { AccountAbstractionMasterWallet } from '../../../masterwallets/account.abstraction.masterwallet';
import { WalletNetworkOptions } from '../../../masterwallets/wallet.types';
import { AddressUsage } from '../../../safes/addressusage';
import { Safe } from '../../../safes/safe';
import { AnyNetworkWallet, WalletAddressInfo } from '../../base/networkwallets/networkwallet';
import { AnySubWallet } from '../../base/subwallets/subwallet';
import { AccountAbstractionProvider } from '../account-abstraction-provider';
import type { EVMNetwork } from '../evm.network';
import { AASafe } from '../safes/aa.safe';
import { MainCoinEVMSubWallet } from '../subwallets/evm.subwallet';
import { EVMNetworkWallet } from './evm.networkwallet';

/**
 * Network wallet type for Account Abstraction wallets on EVM networks
 */
export abstract class AccountAbstractionNetworkWallet extends EVMNetworkWallet<
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
    this.aaProvider = AccountAbstractionProvidersService.instance.getProviderById(this.masterWallet.getAAProviderId());
  }

  protected async prepareStandardSubWallets(): Promise<void> {
    // Create the main token subwallet (ETH, BSC, etc.)
    this.mainTokenSubWallet = new MainCoinEVMSubWallet(this, this.masterWallet.id, this.mainSubWalletFriendlyName);

    // Add both subwallets
    this.subWallets[this.mainTokenSubWallet.id] = this.mainTokenSubWallet;

    return await void 0;
  }

  public getAddresses(): WalletAddressInfo[] {
    const safe = this.safe as AASafe;
    const addresses: WalletAddressInfo[] = [
      {
        title: 'EVM',
        address: safe.getAddresses(0, 1, false, AddressUsage.DEFAULT)[0]
      }
    ];

    return addresses;
  }

  public async convertAddressForUsage(address: string, usage: AddressUsage): Promise<string> {
    return (await address.startsWith('0x')) ? address : '0x' + address;
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

  public getControllerNetworkWallet(): Promise<AnyNetworkWallet> {
    const controllerWalletId = this.masterWallet.getControllerWalletId();
    return WalletService.instance.newNetworkWalletInstance(controllerWalletId, this.network);
  }

  public getAccountAbstractionProvider(): AccountAbstractionProvider {
    return AccountAbstractionProvidersService.instance.getProviderById(this.masterWallet.getAAProviderId());
  }

  public getAccountAbstractionAddress(): string {
    return this.safe.getAddresses(0, 1, false, AddressUsage.DEFAULT)[0];
  }

  /**
   * Bundles a raw transaction, possibly coming from a eth_sendTransaction
   * request, into a UserOp and sends it to the bundler.
   */
  public async signAndSendRawTx(tx: AccountAbstractionTransaction): Promise<string> {
    await TransactionService.instance.displayGenericPublicationLoader();

    TransactionService.instance.resetTransactionPublicationStatus();
    TransactionService.instance.setOnGoingPublishedTransactionState(OutgoingTransactionState.PUBLISHING);

    // Ask the account abstraction provider specific to this account to bundle the transaction
    // and return the actual transaction hash.
    const transactionHash = await this.getAccountAbstractionProvider().bundleTransaction(this, tx);

    if (transactionHash) {
      TransactionService.instance.setOnGoingPublishedTransactionState(OutgoingTransactionState.PUBLISHED);
    } else {
      TransactionService.instance.setOnGoingPublishedTransactionState(OutgoingTransactionState.ERRORED);
    }

    return transactionHash;
  }
}
