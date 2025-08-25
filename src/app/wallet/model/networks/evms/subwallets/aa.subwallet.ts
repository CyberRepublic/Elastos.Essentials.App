import { TranslateService } from "@ngx-translate/core";
import BigNumber from "bignumber.js";
import { Logger } from "src/app/logger";
import { WalletNetworkOptions } from "../../../masterwallets/wallet.types";
import { AddressUsage } from "../../../safes/addressusage";
import { TransactionInfo } from "../../../tx-providers/transaction.types";
import { WalletUtil } from "../../../wallet.util";
import { MainCoinSubWallet } from "../../base/subwallets/maincoin.subwallet";
import { EthTransaction } from "../evm.types";
import { AANetworkWallet } from "../networkwallets/aa.networkwallet";
import { EVMNetworkWallet } from "../networkwallets/evm.networkwallet";

/**
 * Subwallet for Account Abstraction functionality
 */
export class AASubWallet<
  WalletNetworkOptionsType extends WalletNetworkOptions
> extends MainCoinSubWallet<EthTransaction, WalletNetworkOptionsType> {
  private aaNetworkWallet: AANetworkWallet;

  constructor(
    public networkWallet: EVMNetworkWallet<any, WalletNetworkOptionsType>,
    id: string,
    protected friendlyName: string
  ) {
    super(networkWallet, id);
    this.aaNetworkWallet = networkWallet as any as AANetworkWallet;
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    this.tokenDecimals = 18;
    this.tokenAmountMulipleTimes = new BigNumber(10).pow(this.tokenDecimals);
  }

  public getFriendlyName(): string {
    return this.friendlyName;
  }

  public getMainIcon(): string {
    return this.networkWallet.network.logo;
  }

  public getSecondaryIcon(): string {
    return null;
  }

  public getDisplayTokenName(): string {
    return "AA Wallet";
  }

  public isAddressValid(address: string): Promise<boolean> {
    // AA addresses are standard EVM addresses
    return Promise.resolve(WalletUtil.isEVMAddress(address));
  }

  public getBalance(): BigNumber {
    // For AA wallets, we need to check the contract balance
    try {
      // TODO: Implement balance fetching from AA contract
      // For now, return cached balance or 0
      return this.getRawBalance().isNaN()
        ? new BigNumber(0)
        : this.getRawBalance();
    } catch (e) {
      Logger.error("wallet", "Error getting AA wallet balance:", e);
      return new BigNumber(0);
    }
  }

  public getAccountAddress(): string {
    // AA wallets use the contract address
    return this.aaNetworkWallet.getAAContractAddress();
  }

  public getAccountPublicKey(): string {
    // AA wallets don't have traditional public keys
    return null;
  }

  public getAccountPrivateKey(): string {
    // AA wallets don't have private keys
    return null;
  }

  public createTransaction(
    toAddress: string,
    amount: string,
    fee: string,
    memo: string = ""
  ): Promise<EthTransaction> {
    // TODO: Implement AA transaction creation
    throw new Error("AA transaction creation not yet implemented");
  }

  public signTransaction(transaction: EthTransaction): Promise<EthTransaction> {
    // TODO: Implement AA transaction signing
    throw new Error("AA transaction signing not yet implemented");
  }

  protected publishTransaction(
    signedTransaction: string,
    visualFeedback: boolean = true
  ): Promise<string> {
    // TODO: Implement AA transaction publishing
    throw new Error("AA transaction publishing not yet implemented");
  }

  public getTransactionInfo(
    transaction: EthTransaction
  ): Promise<TransactionInfo> {
    // TODO: Implement AA transaction info parsing
    return Promise.resolve(null);
  }

  public getTransactions(
    limit: number = 50,
    offset: number = 0
  ): Promise<EthTransaction[]> {
    // TODO: Implement AA transaction history
    return Promise.resolve([]);
  }

  public async startBackgroundUpdates(): Promise<void> {
    // TODO: Implement AA background updates
    await super.startBackgroundUpdates();
  }

  public async stopBackgroundUpdates(): Promise<void> {
    // TODO: Implement AA background updates stop
    await super.stopBackgroundUpdates();
  }

  public async destroy(): Promise<void> {
    // TODO: Implement AA subwallet cleanup
    await super.destroy();
  }

  public serialize(): any {
    // TODO: Implement AA subwallet serialization
    return {
      type: "aa",
      id: this.id,
    };
  }

  public static newFromSerializedSubWallet(
    networkWallet: EVMNetworkWallet<any, any>,
    serialized: any
  ): AASubWallet<any> {
    // TODO: Implement AA subwallet deserialization
    return new AASubWallet(networkWallet, serialized.id, "Account Abstraction");
  }

  // Required abstract methods from SubWallet
  public getUniqueIdentifierOnNetwork(): string {
    return this.id;
  }

  public getCoin(): any {
    // Return a placeholder coin object for AA wallets
    return {
      network: this.networkWallet.network,
      id: this.id,
      symbol: "AA",
      name: "Account Abstraction",
    };
  }

  public getTransactionName(
    transaction: EthTransaction,
    translate: TranslateService
  ): Promise<string> {
    // TODO: Implement AA transaction naming
    return Promise.resolve("AA Transaction");
  }

  public createAddress(): string {
    // AA wallets use the contract address
    return this.aaNetworkWallet.getAAContractAddress();
  }

  public update(): void {
    // TODO: Implement AA wallet update
    void this.updateBalance();
  }

  public async updateBalance(): Promise<void> {
    // TODO: Implement AA balance update
    try {
      // For now, just update the cache with current balance
      await this.saveBalanceToCache();
    } catch (e) {
      Logger.error("wallet", "Error updating AA wallet balance:", e);
    }
  }

  public getDisplayBalance(): BigNumber {
    return this.getDisplayAmount(this.getRawBalance());
  }

  public getDisplayAmount(amount: BigNumber): BigNumber {
    if (amount.isNaN()) return amount;
    return amount.dividedBy(this.tokenAmountMulipleTimes);
  }

  public getUSDBalance(): BigNumber {
    // TODO: Implement USD balance calculation for AA wallets
    return new BigNumber(0);
  }

  public getOneCoinUSDValue(): BigNumber {
    // TODO: Implement USD value calculation for AA wallets
    return new BigNumber(0);
  }

  public getAmountInExternalCurrency(value: BigNumber): BigNumber {
    // TODO: Implement external currency conversion for AA wallets
    return new BigNumber(0);
  }

  public isBalanceEnough(amount: BigNumber): boolean {
    return this.getRawBalance().gt(
      amount.multipliedBy(this.tokenAmountMulipleTimes)
    );
  }

  public createWithdrawTransaction(
    toAddress: string,
    amount: number,
    memo: string,
    gasPrice: string,
    gasLimit: string,
    nonce: number
  ): Promise<string> {
    // TODO: Implement AA withdraw transaction
    throw new Error("AA withdraw transaction not yet implemented");
  }

  public createPaymentTransaction(
    toAddress: string,
    amount: BigNumber,
    memo: string
  ): Promise<string> {
    // TODO: Implement AA payment transaction
    throw new Error("AA payment transaction not yet implemented");
  }

  public getCurrentReceiverAddress(
    usage: AddressUsage | string = AddressUsage.DEFAULT
  ): string {
    // AA wallets use the contract address as the receiver address
    return this.aaNetworkWallet.getAAContractAddress();
  }

  public getAverageBlocktime(): number {
    return this.networkWallet.getAverageBlocktime();
  }

  public shouldShowOnHomeScreen(): boolean {
    return true;
  }

  public supportMemo(): boolean {
    return false;
  }

  public supportInternalTransactions(): boolean {
    return false;
  }

  public isAmountValid(amount: BigNumber): boolean {
    const amountString = amount.toFixed();
    if (
      amountString.indexOf(".") > -1 &&
      amountString.split(".")[1].length > this.tokenDecimals
    ) {
      return false;
    }
    return true;
  }

  public getSwapInputCurrency(): string {
    return "";
  }

  public getAvailableEarnProviders(): any[] {
    return [];
  }

  public getAvailableSwapProviders(): any[] {
    return [];
  }

  public getAvailableBridgeProviders(): any[] {
    return [];
  }
}
