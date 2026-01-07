import { Logger } from "src/app/logger";
import { EtherscanAPIVersion } from "../../evms/evm.types";
import { AnyMainCoinEVMSubWallet } from "../../evms/subwallets/evm.subwallet";
import { EtherscanEVMSubWalletInternalTransactionProvider } from "../../evms/tx-providers/etherscan.evm.subwallet.internaltx.provider";
import { EtherscanEVMSubWalletProvider } from "../../evms/tx-providers/etherscan.evm.subwallet.provider";
import { NownodeEVMSubWalletProvider } from "../../evms/tx-providers/nownode.evm.subwallet.provider";
import { NownodeEVMSubWalletTokenProvider } from "../../evms/tx-providers/nownode.token.subwallet.provider";
import { EtherscanEVMSubWalletTokenProvider, FetchMode } from "../../evms/tx-providers/etherscan.token.subwallet.provider";
import { EVMTransactionProvider } from "../../evms/tx-providers/evm.transaction.provider";
import { NetworkAPIURLType } from "../../base/networkapiurltype";

const ETH_SCAN_API_KEY = "PCTZJP9TTQ16C37877FSX14Y4YAHAFWY9G";
export class EtherumTransactionProvider extends EVMTransactionProvider {
  private useNownode(mainCoinSubWallet: AnyMainCoinEVMSubWallet): boolean {
    try {
      const nownodeUrl = mainCoinSubWallet.networkWallet.network.getAPIUrlOfType(NetworkAPIURLType.NOWNODE_EXPLORER);
      return !!nownodeUrl;
    } catch (e) {
      // Network doesn't support NOWNODE_EXPLORER, will use Etherscan API
      return false;
    }
  }

  protected createEVMSubWalletProvider(mainCoinSubWallet: AnyMainCoinEVMSubWallet) {
    // Check if network supports nownode API, otherwise use Etherscan API
    if (this.useNownode(mainCoinSubWallet)) {
      Logger.log('wallet', 'EthereumTransactionProvider: Using NownodeEVMSubWalletProvider');
      this.mainProvider = new NownodeEVMSubWalletProvider(this, mainCoinSubWallet);
    } else {
      Logger.log('wallet', 'EthereumTransactionProvider: Using EtherscanEVMSubWalletProvider');
      this.mainProvider = new EtherscanEVMSubWalletProvider(this, mainCoinSubWallet, ETH_SCAN_API_KEY, EtherscanAPIVersion.V2);
    }
  }

  protected createEVMTokenSubWalletProvider(mainCoinSubWallet: AnyMainCoinEVMSubWallet) {
    if (this.useNownode(mainCoinSubWallet)) {
      Logger.log('wallet', 'EthereumTransactionProvider: Using NownodeEVMSubWalletTokenProvider');
      this.tokenProvider = new NownodeEVMSubWalletTokenProvider(this, mainCoinSubWallet);
    } else {
      Logger.log('wallet', 'EthereumTransactionProvider: Using EtherscanEVMSubWalletTokenProvider');
      this.tokenProvider = new EtherscanEVMSubWalletTokenProvider(this, mainCoinSubWallet, FetchMode.Compatibility3, ETH_SCAN_API_KEY, EtherscanAPIVersion.V2);
    }
  }

  protected createEVMSubWalletInternalTransactionProvider(mainCoinSubWallet: AnyMainCoinEVMSubWallet) {
    if (this.useNownode(mainCoinSubWallet)) {
      Logger.log('wallet', 'EthereumTransactionProvider: Using NownodeEVMSubWalletInternalTransactionProvider');
      this.internalTXProvider = null;//new NownodeEVMSubWalletInternalTransactionProvider(this, mainCoinSubWallet);
    } else {
      Logger.log('wallet', 'EthereumTransactionProvider: Using EtherscanEVMSubWalletInternalTransactionProvider');
      this.internalTXProvider = new EtherscanEVMSubWalletInternalTransactionProvider(this, mainCoinSubWallet, ETH_SCAN_API_KEY, EtherscanAPIVersion.V2);
    }
  }
}