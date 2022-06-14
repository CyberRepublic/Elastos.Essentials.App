import { MainchainSubWallet as SDKMainchainSubWallet, MasterWallet as SDKMasterWallet, WalletErrorException } from "@elastosfoundation/wallet-js-sdk";
import moment from "moment";
import { md5 } from "src/app/helpers/crypto/md5";
import { Logger } from "src/app/logger";
import { JSONObject } from "src/app/model/json";
import { GlobalNavService } from "src/app/services/global.nav.service";
import { StandardMultiSigMasterWallet } from "src/app/wallet/model/masterwallets/standard.multisig.masterwallet";
import { MultiSigSafe } from "src/app/wallet/model/safes/multisig.safe";
import { SignTransactionErrorType, SignTransactionResult } from 'src/app/wallet/model/safes/safe.types';
import { AnyOfflineTransaction, OfflineTransaction, OfflineTransactionType, Outputs, UtxoForSDK } from 'src/app/wallet/model/tx-providers/transaction.types';
import { CoinTxInfoParams } from "src/app/wallet/pages/wallet/coin/coin-tx-info/coin-tx-info.page";
import { AuthService } from "src/app/wallet/services/auth.service";
import { Transfer } from "src/app/wallet/services/cointransfer.service";
import { OfflineTransactionsService } from "src/app/wallet/services/offlinetransactions.service";
import { PubKeyInfo, VoteContent } from "src/app/wallet/services/spv.service";
import { Native } from "../../../../../../services/native.service";
import { Safe } from "../../../../../safes/safe";
import { AnyNetworkWallet } from '../../../../base/networkwallets/networkwallet';
import { AnySubWallet } from "../../../../base/subwallets/subwallet";
import { WalletJSSDKHelper } from '../../../wallet.jssdk.helper';
import { ElastosMainChainSafe } from '../mainchain.safe';

export class MainChainMultiSigSafe extends Safe implements ElastosMainChainSafe, MultiSigSafe {
  private sdkMasterWallet: SDKMasterWallet = null;
  private elaSubWallet: SDKMainchainSubWallet = null;

  constructor(protected masterWallet: StandardMultiSigMasterWallet) {
    super(masterWallet);
  }

  public async initialize(networkWallet: AnyNetworkWallet): Promise<void> {
    if (!await WalletJSSDKHelper.maybeCreateStandardMultiSigWalletFromJSWallet(this.masterWallet))
      return;

    this.sdkMasterWallet = await WalletJSSDKHelper.loadMasterWalletFromJSWallet(this.masterWallet);
    this.elaSubWallet = <SDKMainchainSubWallet>this.sdkMasterWallet.getSubWallet("ELA");

    return super.initialize(networkWallet);
  }

  public async getAddresses(startIndex: number, count: number, internalAddresses: boolean): Promise<string[]> {
    return await <string[]>this.elaSubWallet.getAddresses(startIndex, count, internalAddresses);
  }

  public async getOwnerAddress(): Promise<string> {
    return await null; // Not supported by multisig wallets.
  }

  public getOwnerDepositAddress(): Promise<string> {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public async getOwnerPublicKey(): Promise<string> {
    return await null; // Not supported by multisig wallets.
  }

  public getPublicKeys(start: number, count: number, internal: boolean): Promise<string[]> {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public async createPaymentTransaction(inputs: UtxoForSDK[], outputs: Outputs[], fee: string, memo: string): Promise<any> {
    const tx = this.elaSubWallet.createTransaction(inputs, outputs, fee, memo);
    Logger.log("wallet", "Created multisig transaction", tx);

    return await tx;
  }

  public createVoteTransaction(inputs: UtxoForSDK[], voteContent: VoteContent[], fee: string, memo: string): Promise<any> {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createDepositTransaction(inputs: UtxoForSDK[], toSubwalletId: string, amount: string, toAddress: string, lockAddress: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public CRCouncilMemberClaimNodeDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createProposalTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createProposalChangeOwnerTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public terminateProposalOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public terminateProposalCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createTerminateProposalTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalSecretaryGeneralElectionDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalSecretaryGeneralElectionCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createSecretaryGeneralElectionTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalChangeOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalChangeOwnerCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalTrackingSecretaryDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createProposalTrackingTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalReviewDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createProposalReviewTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalTrackingOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public proposalWithdrawDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createProposalWithdrawTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public reserveCustomIDOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public reserveCustomIDCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createReserveCustomIDTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public receiveCustomIDOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public receiveCustomIDCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createReceiveCustomIDTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public changeCustomIDFeeOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public changeCustomIDFeeCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createChangeCustomIDFeeTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public registerSidechainOwnerDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public registerSidechainCRCouncilMemberDigest(payload: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createRegisterSidechainTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createRegisterProducerTransaction(inputs: UtxoForSDK[], payload: string, amount: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createCancelProducerTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createUpdateProducerTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public generateProducerPayload(publicKey: string, nodePublicKey: string, nickname: string, url: string, IPAddress: string, location: number, payPasswd: string): Promise<any> {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public generateCancelProducerPayload(publicKey: string, payPasswd: string): Promise<any> {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createRetrieveDepositTransaction(inputs: UtxoForSDK[], amount: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public getCRDepositAddress() {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public generateCRInfoPayload(publicKey: string, did: string, nickname: string, url: string, location: number) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public generateUnregisterCRPayload(CID: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createRegisterCRTransaction(inputs: UtxoForSDK[], payload: string, amount: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createUnregisterCRTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createUpdateCRTransaction(inputs: UtxoForSDK[], payload: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createRetrieveCRDepositTransaction(inputs: UtxoForSDK[], amount: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public createCRCouncilMemberClaimNodeTransaction(inputs: UtxoForSDK[], amount: string, fee: string, memo: string) {
    // TODO: Do not support.
    return Promise.resolve(null);
  }

  public async signTransaction(subWallet: AnySubWallet, rawTx: JSONObject, transfer: Transfer): Promise<SignTransactionResult> {
    // DEBUG
    //await OfflineTransactionsService.instance.debugRemoveTransactions(subWallet);

    // Transaction key is a md5 of the raw transaction.
    let transactionKey = md5(Buffer.from(JSON.stringify(rawTx)));

    Logger.log("wallet", "Creating offline transaction for the multisig signTransaction() request", rawTx);

    let offlineTransaction: OfflineTransaction<any> = {
      transactionKey,
      type: OfflineTransactionType.MULTI_SIG_STANDARD,
      updated: moment().unix(),
      rawTx
    };
    await OfflineTransactionsService.instance.storeTransaction(subWallet, offlineTransaction);

    Logger.log("wallet", "Multisig safe created an initial offline transaction:", offlineTransaction);

    let params: CoinTxInfoParams = {
      masterWalletId: this.networkWallet.id,
      subWalletId: subWallet.id,
      offlineTransaction
    };
    GlobalNavService.instance.clearIntermediateRoutes(["/wallet/coin-transfer"]); // Don't allow to come back to the payment screen
    Native.instance.go("/wallet/coin-tx-info", params);

    return {
      errorType: SignTransactionErrorType.DELEGATED
    };
  }

  private getSigningWalletXPubKey(): string {
    let pubKeyInfo = <PubKeyInfo>this.sdkMasterWallet.getPubKeyInfo();
    console.log("hasSigningWalletSigned", "pubKeyInfo", pubKeyInfo)
    return pubKeyInfo.xPubKeyHDPM;
  }

  public hasSigningWalletSigned(tx: any): Promise<boolean> {
    return this.hasCosignerSigned(this.getSigningWalletXPubKey(), tx);
  }

  public async hasCosignerSigned(xpub: string, tx: any): Promise<boolean> {
    // Including the user himself in the list, as a "cosigner"
    let allXPubs = [
      this.getSigningWalletXPubKey(),
      ...(<StandardMultiSigMasterWallet>this.masterWallet).signersExtPubKeys
    ]

    let signers = this.elaSubWallet.matchSigningPublicKeys(tx, allXPubs, false);
    console.log("signers", signers)
    let matchingCosigner = signers.find(s => s.xPubKey === xpub);
    if (!matchingCosigner)
      return false; // Should not happen

    return await matchingCosigner.signed;
  }

  public async convertSignedTransactionToPublishableTransaction(subWallet: AnySubWallet, signedTx: string): Promise<string> {
    return await this.elaSubWallet.convertToRawTransaction(JSON.parse(signedTx));
  }

  public async signTransactionReal(subWallet: AnySubWallet, rawTx: any): Promise<SignTransactionResult> {
    let payPassword = await AuthService.instance.getWalletPassword(this.masterWallet.id);
    if (!payPassword) {
      return {
        errorType: SignTransactionErrorType.CANCELLED
      }; // Can't continue without the wallet password
    }

    try {
      let sdkRawTransaction = this.elaSubWallet.convertToRawTransaction(rawTx); // Only for logs
      Logger.log("wallet", "Multisig safe signTransactionReal() sdkRawTransaction:", sdkRawTransaction);

      let signedTx = await this.elaSubWallet.signTransaction(rawTx, payPassword);
      Logger.log("wallet", "Multisig safe transaction signature result:", signedTx);
      return {
        signedTransaction: JSON.stringify(signedTx)
      }
    }
    catch (e) {
      if (e instanceof WalletErrorException && e.code === 20046) { // AlreadySigned
        Logger.warn("wallet", "Transaction was already signed, returning the original transaction as 'signed'.", rawTx);
        return {
          signedTransaction: JSON.stringify(rawTx)
        }
      }
      else {
        return {
          errorType: SignTransactionErrorType.FAILURE
        }
      }
    }
  }

  public async hasEnoughSignaturesToPublish(signedTx: any): Promise<boolean> {
    try {
      // getTransactionSignedInfo() returns one entry per transaction input address (program)
      // Each entry contains en array of signers.
      // Normally, all programs are always signed by a cosigner at the same time so we check the first entry's
      // signers size to know how many cosigners have signed te transaction.
      let signedInfo = this.elaSubWallet.getTransactionSignedInfo(signedTx) as { Signers: string[] }[];
      if (!signedInfo || signedInfo.length === 0)
        return false;

      return signedInfo[0].Signers.length >= (<StandardMultiSigMasterWallet>this.masterWallet).requiredSigners;
    }
    catch (e) {
      Logger.error("wallet", "Multisig safe hasEnoughSignaturesToPublish() error:", e);
      return await false;
    }
  }

  /**
   * The "hash" part of a transaction doesn't change after signing, so this method can be used
   * for unsigned transactions, or partly signed ones.
   * The returns "hash" corresponds to the txid on chain.
   */
  public async getOfflineTransactionHash(offlineTransaction: AnyOfflineTransaction): Promise<string> {
    try {
      return await this.elaSubWallet.decodeTx(offlineTransaction.rawTx).getHashString();
    } catch (e) {
      Logger.error("wallet", "Multisig safe: getOfflineTransactionHash() error:", e);
    }
  }
}