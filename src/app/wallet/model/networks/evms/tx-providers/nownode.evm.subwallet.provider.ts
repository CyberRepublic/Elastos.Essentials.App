import { Logger } from "src/app/logger";
import { GlobalBTCRPCService } from "src/app/services/global.btc.service";
import { ProviderTransactionInfo } from "../../../tx-providers/providertransactioninfo";
import { SubWalletTransactionProvider } from "../../../tx-providers/subwallet.provider";
import { TransactionProvider } from "../../../tx-providers/transaction.provider";
import { NetworkAPIURLType } from "../../base/networkapiurltype";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { EthTransaction } from "../evm.types";
import { TransactionDirection } from "../../../tx-providers/transaction.types";

const MAX_RESULTS_PER_FETCH = 30;

/**
 * Nownode API-based transaction provider for EVM networks.
 * Uses nownode explorer API to fetch address transactions.
 */
export class NownodeEVMSubWalletProvider<SubWalletType extends AnySubWallet> extends SubWalletTransactionProvider<SubWalletType, EthTransaction> {
  protected canFetchMore = true;

  constructor(provider: TransactionProvider<any>, subWallet: SubWalletType) {
    super(provider, subWallet);
  }

  protected getProviderTransactionInfo(transaction: EthTransaction): ProviderTransactionInfo {
    return {
      cacheKey: this.subWallet.masterWallet.id + "-" + this.subWallet.networkWallet.network.key + "-" + this.subWallet.id + "-transactions",
      cacheEntryKey: transaction.hash,
      cacheTimeValue: parseInt(transaction.timeStamp),
      subjectKey: this.subWallet.id
    };
  }

  public canFetchMoreTransactions(subWallet: AnySubWallet): boolean {
    return this.canFetchMore;
  }

  public async fetchTransactions(subWallet: AnySubWallet, afterTransaction?: EthTransaction): Promise<void> {
    const accountAddress = this.subWallet.getCurrentReceiverAddress();

    let page = 1;
    // Compute the page to fetch from the api, based on the current position of "afterTransaction" in the list
    if (afterTransaction) {
      let afterTransactionIndex = (await this.getTransactions(subWallet)).findIndex(t => t.hash === afterTransaction.hash);
      if (afterTransactionIndex) { // Just in case, should always be true but...
        // Ex: if tx index in current list of transactions is 18 and we use 8 results per page
        // then the page to fetch is 2: Math.floor(18 / 8) + 1 - API page index starts at 1
        page = 1 + Math.floor((afterTransactionIndex + 1) / MAX_RESULTS_PER_FETCH);
      }
      Logger.log('wallet', 'NownodeEVMSubWalletProvider fetchTransactions page:', page);
    }

    // Get nownode API URL
    let nownodeApiUrl: string;
    try {
      nownodeApiUrl = this.subWallet.networkWallet.network.getAPIUrlOfType(NetworkAPIURLType.NOWNODE_EXPLORER);
    } catch (e) {
      Logger.error('wallet', 'NownodeEVMSubWalletProvider: Network does not support NOWNODE_EXPLORER:', e);
      return null;
    }

    try {
      // Step 1: Get address info with txids list (similar to BTCSubWalletProvider)
      let addressInfo = await GlobalBTCRPCService.instance.getEVMAddressInfo(nownodeApiUrl, accountAddress, MAX_RESULTS_PER_FETCH, page);

      if (!addressInfo || !addressInfo.txids) {
        Logger.warn('wallet', 'nownode fetchTransactions invalid addressInfo:', addressInfo);
        return null;
      }

      // Check if we can fetch more
      if (addressInfo.txids.length < MAX_RESULTS_PER_FETCH) {
        this.canFetchMore = false;
      } else {
        this.canFetchMore = true;
      }

      // Step 2: Fetch transaction details for each txid (similar to BTCSubWalletProvider.getRawTransactionByTxid)
      if (addressInfo.txids.length > 0) {
        await this.getTransactionsByTxids(subWallet, nownodeApiUrl, addressInfo.txids);
      }
    } catch (e) {
      Logger.error('wallet', 'NownodeEVMSubWalletProvider fetchTransactions error:', e);
    }
    return null;
  }

  // Get transaction details by txids (similar to BTCSubWalletProvider.getRawTransactionByTxid)
  private async getTransactionsByTxids(subWallet: AnySubWallet, nownodeApiUrl: string, txidList: string[]): Promise<void> {
    if (!txidList || txidList.length === 0) return;

    let existingTransactions = await this.getTransactions(subWallet);
    let newTransactions: EthTransaction[] = [];

    for (let txid of txidList) {
      // Check if transaction already exists in cache
      let existingTx = existingTransactions.find((tx) => tx.hash === txid);

      // If transaction doesn't exist or needs update, fetch it
      if (!existingTx) {
        try {
          let transaction = await GlobalBTCRPCService.instance.getEVMTransactionByHash(nownodeApiUrl, txid);
          if (transaction) {
            this.updateTransactionInfo(subWallet, transaction);
            newTransactions.push(transaction);
          }
        } catch (err) {
          Logger.warn('wallet', 'NownodeEVMSubWalletProvider: Failed to fetch tx:', txid, err);
        }
      }
    }

    // Save new transactions
    if (newTransactions.length > 0) {
      await this.saveTransactions(newTransactions);
    }
  }

  private updateTransactionInfo(subWallet: AnySubWallet, transaction: EthTransaction) {
    let tokenAddress = subWallet.getCurrentReceiverAddress();
    if (transaction.to.toLowerCase() === tokenAddress.toLowerCase()) {
      transaction.Direction = TransactionDirection.RECEIVED;
    } else {
      transaction.Direction = TransactionDirection.SENT;
    }
  }
}

