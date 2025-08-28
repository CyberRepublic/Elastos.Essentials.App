import { BigNumber } from "bignumber.js";
import { TransactionInfo } from "../../../tx-providers/transaction.types";
import { EthTransaction } from "../evm.types";
import { MainCoinEVMSubWallet } from "./evm.subwallet";

/**
 * Subwallet for Account Abstraction functionality
 */
export class AccountAbstractionSubWallet extends MainCoinEVMSubWallet<any> {
  public getAccountAddress(): string {
    // AA wallets use the address returned by the AA provider.
    return this.networkWallet.getAddresses()[0].address;
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
    memo = ""
  ): Promise<EthTransaction> {
    // TODO: Implement AA transaction creation
    throw new Error("AA transaction creation not yet implemented");
  }

  public signTransaction(transaction: EthTransaction): Promise<EthTransaction> {
    // TODO: Implement AA transaction signing
    throw new Error("AA transaction signing not yet implemented");
  }

  public publishTransaction(
    signedTransaction: string,
    visualFeedback = true
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

  public getTransactions(limit = 50, offset = 0): Promise<EthTransaction[]> {
    // TODO: Implement AA transaction history
    return Promise.resolve([]);
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

  public createAddress(): string {
    // AA wallets use the address returned by the AA contract.
    return this.networkWallet.getAddresses()[0].address;
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
}
