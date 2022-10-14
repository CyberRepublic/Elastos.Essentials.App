import type { json } from "@elastosfoundation/wallet-js-sdk/typings/types";
import { lazyEthersImport, lazyEthersLibUtilImport } from "src/app/helpers/import.helper";
import { Logger } from "src/app/logger";
import { AuthService } from "src/app/wallet/services/auth.service";
import { Transfer } from "src/app/wallet/services/cointransfer.service";
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { StandardMasterWallet } from "../../../masterwallets/masterwallet";
import { Safe } from "../../../safes/safe";
import { SignTransactionResult } from "../../../safes/safe.types";
import { AnyNetworkWallet } from "../../base/networkwallets/networkwallet";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { EVMSafe } from "./evm.safe";

/**
 * Safe specialized for EVM networks, with additional methods.
 */
export class EVMWalletJSSafe extends Safe implements EVMSafe {
  private account = null;
  private evmAddress = null;

  constructor(protected masterWallet: StandardMasterWallet, protected chainId: number) {
    super(masterWallet);
  }

  public async initialize(networkWallet: AnyNetworkWallet): Promise<void> {
    await super.initialize(networkWallet);

    // Check if the address is already computed or not  (first time). If not, request the
    // master password to compute it
    this.evmAddress = await networkWallet.loadContextInfo("evmAddress");
    if (!this.evmAddress) {
      await this.initJSWallet()

      if (this.account) {
        this.evmAddress = this.account.address;
      }

      if (this.evmAddress)
        await networkWallet.saveContextInfo("evmAddress", this.evmAddress);
    }
  }

  private async initJSWallet() {
    if (this.account) return;

    // No data - need to compute
    let payPassword = await AuthService.instance.getWalletPassword(this.masterWallet.id);
    if (!payPassword)
      return; // Can't continue without the wallet password - cancel the initialization

    let privateKey = null;
    let seed = await (this.masterWallet as StandardMasterWallet).getSeed(payPassword);
    if (seed) {
      let jsWallet = await this.getWalletFromSeed(seed);
      privateKey = jsWallet.privateKey;
    }
    else {
      // No mnemonic - check if we have a private key instead
      privateKey = await (this.masterWallet as StandardMasterWallet).getPrivateKey(payPassword);
    }

    if (privateKey) {
      this.account = (await EVMService.instance.getWeb3(this.networkWallet.network)).eth.accounts.privateKeyToAccount(privateKey);
    }
  }

  public getAddresses(startIndex: number, count: number, internalAddresses: boolean): string[] {
    return [this.evmAddress];
  }

  public createTransferTransaction(toAddress: string, amount: string, gasPrice: string, gasLimit: string, nonce: number): Promise<any> {
    return EVMService.instance.createUnsignedTransferTransaction(toAddress, amount, gasPrice, gasLimit, nonce);
  }

  public createContractTransaction(contractAddress: string, amount: string, gasPrice: string, gasLimit: string, nonce: number, data: any): Promise<any> {
    return EVMService.instance.createUnsignedContractTransaction(contractAddress, amount, gasPrice, gasLimit, nonce, data);
  }

  public async signTransaction(subWallet: AnySubWallet, rawTransaction: json, transfer: Transfer, forcePasswordPrompt = true, visualFeedback = true): Promise<SignTransactionResult> {
    Logger.log('wallet', ' signTransaction rawTransaction', rawTransaction)

    let signedTx = null

    // Must be confirmed by the user.
    let payPassword = await AuthService.instance.getWalletPassword(this.masterWallet.id, true, true);
    if (!payPassword)
      return { signedTransaction: signedTx };

    await this.initJSWallet();

    if (this.account) {
      let signdTransaction = await this.account.signTransaction(rawTransaction)
      signedTx = signdTransaction.rawTransaction;
    }
    return { signedTransaction: signedTx };
  }

  private async getWalletFromSeed(seed: string) {
    const { Wallet } = await lazyEthersImport();
    const { HDNode, defaultPath } = await lazyEthersLibUtilImport();
    return new Wallet(HDNode.fromSeed(Buffer.from(seed, "hex")).derivePath(defaultPath));
  }
}