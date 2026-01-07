import { Logger } from "src/app/logger";
import { GlobalBTCRPCService } from "src/app/services/global.btc.service";
import { TokenType } from "../../../coin";
import { ProviderTransactionInfo } from "../../../tx-providers/providertransactioninfo";
import { SubWalletTransactionProvider } from "../../../tx-providers/subwallet.provider";
import { TransactionProvider } from "../../../tx-providers/transaction.provider";
import { NetworkAPIURLType } from "../../base/networkapiurltype";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { ERCTokenInfo, EthTokenTransaction, EthTransaction } from "../evm.types";
import { ERC20SubWallet } from "../subwallets/erc20.subwallet";
import { MainCoinEVMSubWallet } from "../subwallets/evm.subwallet";

const MAX_RESULTS_PER_FETCH = 30;

/**
 * Nownode API-based token transaction provider for EVM networks.
 * Uses nownode explorer API to fetch ERC20/ERC721/ERC1155 token transactions.
 */
export class NownodeEVMSubWalletTokenProvider<SubWalletType extends MainCoinEVMSubWallet<any>> extends SubWalletTransactionProvider<SubWalletType, EthTransaction> {
  protected canFetchMore = true;

  constructor(provider: TransactionProvider<any>, subWallet: SubWalletType) {
    super(provider, subWallet);

    // Discover new transactions globally for all tokens at once, in order to notify user
    // of NEW tokens received, and NEW payments received for existing tokens.
    provider.refreshEvery(() => this.discoverTokens(), 60000);
  }

  protected getProviderTransactionInfo(transaction: EthTransaction): ProviderTransactionInfo {
    return {
      cacheKey: this.subWallet.masterWallet.id + "-" + this.subWallet.networkWallet.network.key + "-" + transaction.contractAddress.toLowerCase() + "-transactions",
      cacheEntryKey: transaction.hash,
      cacheTimeValue: parseInt(transaction.timeStamp),
      subjectKey: transaction.contractAddress
    };
  }

  public canFetchMoreTransactions(subWallet: AnySubWallet): boolean {
    return this.canFetchMore;
  }

  public async fetchTransactions(erc20SubWallet: ERC20SubWallet, afterTransaction?: EthTransaction): Promise<void> {
    let page = 1;
    // Compute the page to fetch from the api, based on the current position of "afterTransaction" in the list
    if (afterTransaction) {
      let afterTransactionIndex = (await this.getTransactions(erc20SubWallet)).findIndex(t => t.hash === afterTransaction.hash);
      if (afterTransactionIndex) { // Just in case, should always be true but...
        // Ex: if tx index in current list of transactions is 18 and we use 8 results per page
        // then the page to fetch is 2: Math.floor(18 / 8) + 1 - API page index starts at 1
        page = 1 + Math.floor((afterTransactionIndex + 1) / MAX_RESULTS_PER_FETCH);
      }
    }

    const accountAddress = (await this.subWallet.getCurrentReceiverAddress()).toLowerCase();
    const contractAddress = erc20SubWallet.coin.getContractAddress().toLowerCase();

    // Get nownode API URL
    let nownodeApiUrl: string;
    try {
      nownodeApiUrl = this.subWallet.networkWallet.network.getAPIUrlOfType(NetworkAPIURLType.NOWNODE_EXPLORER);
    } catch (e) {
      Logger.error('wallet', 'NownodeEVMSubWalletTokenProvider: Network does not support NOWNODE_EXPLORER:', e);
      return null;
    }

    try {
      let result = await GlobalBTCRPCService.instance.getEVMTokenTransactions(
        nownodeApiUrl,
        accountAddress,
        contractAddress,
        MAX_RESULTS_PER_FETCH,
        page
      );

      if (!result || !result.result) {
        Logger.warn('wallet', 'nownode fetchTokenTransactions invalid result:', result);
        return null;
      }

      let transactions = result.result as EthTransaction[];
      if (!(transactions instanceof Array)) {
        Logger.warn('wallet', 'nownode fetchTokenTransactions invalid transactions:', transactions);
        return null;
      }

      if (transactions.length < MAX_RESULTS_PER_FETCH) {
        // Got less results than expected: we are at the end of what we can fetch. remember this
        // (in memory only)
        this.canFetchMore = false;
      } else {
        this.canFetchMore = true;
      }

      await this.saveTransactions(transactions);
    } catch (e) {
      Logger.error('wallet', 'NownodeEVMSubWalletTokenProvider fetchTransactions error:', e);
    }
    return null;
  }

  public async discoverTokens(): Promise<void> {
    // Note: nownode API may not support token discovery in the same way as Etherscan
    // This is a simplified implementation - may need adjustment based on actual nownode API capabilities
    let tokenSubWallet = this.subWallet;
    const address = await tokenSubWallet.getAccountAddress();
    let totalTokens: ERCTokenInfo[] = [];

    // Get nownode API URL
    let nownodeApiUrl: string;
    try {
      nownodeApiUrl = this.subWallet.networkWallet.network.getAPIUrlOfType(NetworkAPIURLType.NOWNODE_EXPLORER);
    } catch (e) {
      Logger.warn('wallet', 'NownodeEVMSubWalletTokenProvider: Network does not support NOWNODE_EXPLORER for token discovery:', e);
      return;
    }

    try {
      // Try to get token list from nownode API
      // Note: This endpoint may vary depending on nownode API implementation
      let result = await GlobalBTCRPCService.instance.getEVMTokenList(nownodeApiUrl, address);

      if (result && Array.isArray(result)) {
        for (let token of result) {
          totalTokens.push({
            balance: '0',
            contractAddress: token.contract || '',
            decimals: token.decimals?.toString() || '18',
            name: token.name || '',
            symbol: token.symbol || '',
            type: this.determineTokenType(token),
            hasOutgoTx: false, // nownode API may not provide this info directly
          });
        }
      }
    } catch (e) {
      Logger.warn('wallet', 'NownodeEVMSubWalletTokenProvider discoverTokens error:', e);
      // If token discovery fails, we can still continue - tokens will be discovered when transactions are fetched
      return;
    }

    // Let the provider know what we have found
    await this.provider.onTokenInfoFound(totalTokens);
  }

  private determineTokenType(token: any): TokenType {
    // Try to determine token type from nownode response
    if (token.type) {
      if (token.type === 'BEP721' || token.type === '721') return TokenType.ERC_721;
      if (token.type === 'BEP1155' || token.type === '1155') return TokenType.ERC_1155;
    }
    // Default to ERC20
    return TokenType.ERC_20;
  }
}

