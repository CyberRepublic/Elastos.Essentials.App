import { BigNumber } from 'bignumber.js';
import { Subject } from 'rxjs';
import { GlobalRedPacketServiceAddresses } from 'src/app/config/globalconfig';
import { lazyWeb3Import } from 'src/app/helpers/import.helper';
import { runDelayed } from 'src/app/helpers/sleep.helper';
import { Logger } from 'src/app/logger';
import { Util } from 'src/app/model/util';
import { GlobalEthereumRPCService } from 'src/app/services/global.ethereum.service';
import { GlobalTranslationService } from 'src/app/services/global.translation.service';
import { BridgeService } from 'src/app/wallet/services/evm/bridge.service';
import { EarnService } from 'src/app/wallet/services/evm/earn.service';
import { SwapService } from 'src/app/wallet/services/evm/swap.service';
import type Web3 from 'web3';
import { Config } from '../../../../config/Config';
import { CurrencyService } from '../../../../services/currency.service';
import { Coin, CoinID, CoinType, ERC20Coin } from '../../../coin';
import { BridgeProvider } from '../../../earn/bridgeprovider';
import { EarnProvider } from '../../../earn/earnprovider';
import { SwapProvider } from '../../../earn/swapprovider';
import type { MasterWallet } from '../../../masterwallets/masterwallet';
import type { WalletNetworkOptions } from '../../../masterwallets/wallet.types';
import { AddressUsage } from '../../../safes/addressusage';
import {
  TransactionDirection,
  TransactionInfo,
  TransactionStatus,
  TransactionType
} from '../../../tx-providers/transaction.types';
import { WalletUtil } from '../../../wallet.util';
import type { AnyNetworkWallet } from '../../base/networkwallets/networkwallet';
import { SerializedSubWallet, SubWallet } from '../../base/subwallets/subwallet';
import { ETHTransactionInfoParser } from '../ethtransactioninfoparser';
import type { EVMNetwork } from '../evm.network';
import type { EthTransaction } from '../evm.types';
import type { AnyEVMNetworkWallet, EVMNetworkWallet } from '../networkwallets/evm.networkwallet';
import type { EVMSafe } from '../safes/evm.safe';

export class ERC20SubWallet extends SubWallet<EthTransaction, any> {
  private network: EVMNetwork;
  /** Coin related to this wallet */
  public coin: ERC20Coin;
  private erc20ABI: any;

  private tokenAddress = '';

  protected spvConfigEVMCode: string = null; // Ex: ETHHECO, ETHSC
  private fetchTokenValueTimer: any = null;
  private redPacketServerAddress = null;
  protected txInfoParser: ETHTransactionInfoParser;

  // For fusion FRC759:
  public hasParentWallet = false;

  public static async newFromCoin(
    networkWallet: EVMNetworkWallet<MasterWallet, WalletNetworkOptions>,
    coin: Coin
  ): Promise<ERC20SubWallet> {
    const subWallet = await networkWallet.network.createERC20SubWallet(networkWallet, coin.getID());
    return subWallet;
  }

  public static async newFromSerializedSubWallet(
    networkWallet: AnyEVMNetworkWallet,
    serializedSubWallet: SerializedSubWallet
  ): Promise<ERC20SubWallet> {
    //Logger.log('wallet', "Initializing ERC20 subwallet from serialized sub wallet", serializedSubWallet);
    if (!serializedSubWallet.id) {
      Logger.error('wallet', 'newFromSerializedSubWallet id is null');
      return null;
    }
    // Use the contract address as id for ERC20 subwallet.
    const coin = networkWallet.network.getERC20CoinByContractAddress(serializedSubWallet.id) as ERC20Coin;
    if (coin) {
      const subWallet = await networkWallet.network.createERC20SubWallet(networkWallet, serializedSubWallet.id, false);
      return subWallet;
    } else {
      Logger.error('wallet', 'newFromSerializedSubWallet error, this coin is not a known coin for this network.');
      return null;
    }
  }

  public constructor(
    public networkWallet: AnyNetworkWallet,
    id: CoinID,
    protected displayableERC20TokenInfo: string // Ex: "HRC20 Token"
  ) {
    super(networkWallet, id, CoinType.ERC20);

    this.network = <EVMNetwork>networkWallet.network;
    this.spvConfigEVMCode = this.networkWallet.network.getEVMSPVConfigName();
  }

  public async initialize(): Promise<void> {
    this.coin = this.network.getCoinByID(this.id) as ERC20Coin;
    this.tokenDecimals = this.coin.decimals;
    this.tokenAmountMulipleTimes = new BigNumber(10).pow(this.tokenDecimals);

    await super.initialize();

    // Standard ERC20 contract ABI
    this.erc20ABI = require('src/assets/wallet/ethereum/StandardErc20ABI.json');

    this.redPacketServerAddress = GlobalRedPacketServiceAddresses[this.spvConfigEVMCode];

    this.txInfoParser = new ETHTransactionInfoParser(this.networkWallet.network);
  }

  /**
   * Creates a new Web3 instance with fresh RPC URL. We recreate it each time to ensure
   * we always use the latest selected RPC URL instead of a cached one.
   */
  private async createWeb3(highPriority = false): Promise<Web3> {
    const EssentialsWeb3Provider = (await import('src/app/model/essentialsweb3provider')).EssentialsWeb3Provider;
    const Web3 = await lazyWeb3Import();
    const rpcUrl = this.networkWallet.network.getSelectedRpcUrl();
    return new Web3(new EssentialsWeb3Provider(rpcUrl, this.network.key, highPriority));
  }

  public async startBackgroundUpdates(): Promise<void> {
    await super.startBackgroundUpdates();

    runDelayed(() => {
      void this.updateBalance(true);
      void this.fetchAndRearmTokenValue();
    }, 5000);
    return;
  }

  public async stopBackgroundUpdates(): Promise<void> {
    await super.stopBackgroundUpdates();
    clearTimeout(this.fetchTokenValueTimer);
    return;
  }

  public getCoin(): ERC20Coin {
    return this.coin;
  }

  public getAvailableEarnProviders(): EarnProvider[] {
    return EarnService.instance.getAvailableEarnProviders(this);
  }

  public getAvailableSwapProviders(): SwapProvider[] {
    return SwapService.instance.getAvailableSwapProviders(this);
  }

  public getAvailableBridgeProviders(): BridgeProvider[] {
    return BridgeService.instance.getAvailableBridgeProviders(this);
  }

  private async fetchAndRearmTokenValue(): Promise<void> {
    if (this.backGroundUpdateStoped) return;

    await this.fetchTokenValue();

    this.fetchTokenValueTimer = setTimeout(() => {
      void this.fetchAndRearmTokenValue();
    }, 60000);
  }

  private async fetchTokenValue(): Promise<void> {
    await CurrencyService.instance.fetchERC20TokenValue(this.coin, this.network);
  }

  public getUniqueIdentifierOnNetwork(): string {
    return this.coin.getContractAddress().toLowerCase();
  }

  public createAddress(): string {
    // Create on ETH always returns the same unique address.
    let addresses = this.networkWallet.safe.getAddresses(0, 1, false, AddressUsage.EVM_CALL);
    return addresses && addresses[0] ? addresses[0] : null;
  }

  public getTokenAccountAddress(): string {
    if (!this.tokenAddress) {
      this.tokenAddress = this.getCurrentReceiverAddress()?.toLowerCase();
    }
    return this.tokenAddress;
  }

  public getFriendlyName(): string {
    const coin = this.network.getCoinByID(this.id);
    if (!coin) {
      return ''; // Just in case
    }
    return coin.getDescription();
  }

  public getDisplayTokenName(): string {
    const coin = this.network.getCoinByID(this.id);
    if (!coin) {
      return ''; // Just in case
    }
    return coin.getSymbol();
  }

  public isAddressValid(address: string): Promise<boolean> {
    return WalletUtil.isEVMAddress(address);
  }

  public transactionsListChanged(): Subject<void> {
    return this.networkWallet
      .getTransactionDiscoveryProvider()
      .transactionsListChanged(this.getUniqueIdentifierOnNetwork());
  }

  public getDisplayBalance(): BigNumber {
    return this.getDisplayAmount(this.getRawBalance());
  }

  public getDisplayAmount(amount: BigNumber): BigNumber {
    return amount.dividedBy(this.tokenAmountMulipleTimes);
  }

  // The resurn value is devided by the number of decimals used by the token.
  public getDisplayValue(amount: string): BigNumber {
    return new BigNumber(amount).dividedBy(this.tokenAmountMulipleTimes);
  }

  public getAmountInExternalCurrency(value: BigNumber): BigNumber {
    let amount = CurrencyService.instance.getERC20TokenValue(value, this.coin, this.networkWallet.network);
    if (amount) {
      let decimalplace = 3;
      if (CurrencyService.instance.selectedCurrency && CurrencyService.instance.selectedCurrency.decimalplace) {
        decimalplace = CurrencyService.instance.selectedCurrency.decimalplace;
      }
      // If the amount is less than 1, more decimal parts are displayed.
      if (!amount.isGreaterThan(1)) {
        decimalplace += 2;
      }
      return amount.decimalPlaces(decimalplace);
    } else {
      return amount;
    }
  }

  public getUSDBalance(): BigNumber {
    let usdBalance = CurrencyService.instance.getERC20TokenValue(
      this.getBalance(),
      this.coin,
      this.networkWallet.network,
      'USD'
    );
    return usdBalance || new BigNumber(0);
  }

  public getOneCoinUSDValue(): BigNumber {
    return CurrencyService.instance.getERC20TokenValue(new BigNumber(1), this.coin, this.networkWallet.network, 'USD');
  }

  public getMainIcon(): string {
    return this.networkWallet.network.logo;
  }

  public getSecondaryIcon(): string {
    return null;
    // TODO: show real token icon for famous tokens, or placeholder image for unknown tokens.
    //return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAQAAAAm93DmAAAAJklEQVR42u3MMQEAAAgDINc/9AyhJwQg7byKUCgUCoVCoVAoFN4sl/dP2UHkSR8AAAAASUVORK5CYII=";
  }

  /**
   * Returns the info string to show to describe the type of ERC20 tokens held by this subwallet.
   * i.e.: "Elastos ERC20 token"
   */
  public getDisplayableERC20TokenInfo(): string {
    return this.displayableERC20TokenInfo;
  }

  /**
   * Check whether the balance is enough.
   * @param amount unit is WEI
   */
  public isBalanceEnough(amount: BigNumber) {
    // The fee is ELA/ETHSC, not ERC20 TOKEN. So can send all the balance.
    return this.getRawBalance().gte(amount.multipliedBy(this.tokenAmountMulipleTimes));
  }

  private async getERC20TransactionDirection(targetAddress: string): Promise<TransactionDirection> {
    const address = this.getTokenAccountAddress();
    if (address === targetAddress.toLowerCase()) {
      return await TransactionDirection.RECEIVED;
    } else {
      return await TransactionDirection.SENT;
    }
  }

  private checkRedPacketTransaction(transaction: EthTransaction) {
    if (transaction.from.toLowerCase() === this.redPacketServerAddress) {
      transaction.isRedPacket = true;
    } else {
      transaction.isRedPacket = false;
    }
  }

  public async update(runInBackground = false) {
    await this.updateBalance(runInBackground);
  }

  public async updateBalance(runInBackground = false): Promise<void> {
    // BPI REMOVED - This method should update when we call it. The backGroundUpdateStoped logic must be done somewhere else.
    // if (this.backGroundUpdateStoped) return;
    //Logger.log('wallet', "Updating ERC20 token balance for token: ", this.coin.getName());
    if (typeof this.tokenDecimals == 'undefined' || this.tokenDecimals === null) {
      Logger.error('wallet', 'Token decimals unknown for token ' + this.coin.getID());
      return;
    }

    if (runInBackground && this.backGroundUpdateStoped) {
      return;
    }

    try {
      const tokenAccountAddress = this.getTokenAccountAddress();
      const contractAddress = this.coin.getContractAddress();
      const web3 = await this.createWeb3(); // Create fresh web3 instance to get latest RPC URL
      const erc20Contract = new web3.eth.Contract(this.erc20ABI, contractAddress, { from: tokenAccountAddress });

      // TODO: what's the integer type returned by web3? Are we sure we can directly convert it to BigNumber like this? To be tested
      const rawBalance = await erc20Contract.methods.balanceOf(tokenAccountAddress).call();
      if (rawBalance) {
        this.balance = new BigNumber(rawBalance);
        await this.saveBalanceToCache();
        // Logger.log('wallet', this.coin.getSymbol(), this.id + ": balance:", this.getRawBalance().toFixed());
      }
    } catch (error) {
      Logger.log('wallet', 'ERC20 Token (', this.coin.getSymbol(), this.id, ') updateBalance error:', error);
    }
  }

  public getTransactionsCacheKey(): string {
    return (
      this.masterWallet.id +
      '-' +
      this.networkWallet.network.key +
      '-' +
      this.coin.getContractAddress().toLowerCase() +
      '-transactions'
    );
  }

  /* public async getTransactions(startIndex: number): Promise<ElastosPaginatedTransactions> {
        if (this.paginatedTransactions == null) {
          await this.getTransactionsByRpc();
          this.loadTxDataFromCache = false;
        } else {
          this.loadTxDataFromCache = true;
        }

        if (this.paginatedTransactions) {
          // For performance, only return 20 transactions.
          let newTxList:ElastosPaginatedTransactions = {
            totalcount: this.paginatedTransactions.totalcount,
            txhistory :this.paginatedTransactions.txhistory.slice(startIndex, startIndex + 20),
          }
          return newTxList;
        } else {
          return null;
        }
    } */

  public async getTransactionByHash(hash: string): Promise<EthTransaction> {
    let transactions = await this.getTransactions();
    if (transactions) {
      let existingIndex = (transactions as EthTransaction[]).findIndex(i => i.hash == hash);
      if (existingIndex >= 0) {
        return transactions[existingIndex] as EthTransaction;
      }
    }
    return null;
  }

  public async getTransactionDetails(txid: string): Promise<EthTransaction> {
    let result = await GlobalEthereumRPCService.instance.eth_getTransactionByHash(
      this.networkWallet.network.getSelectedRpcUrl(),
      txid,
      this.networkWallet.network.key
    );
    if (!result) {
      // Remove error transaction.
      // TODO await this.removeInvalidTransaction(txid);
    }
    return result;
  }

  public async getTransactionInfo(transaction: EthTransaction): Promise<TransactionInfo> {
    if (transaction.hide) return null;

    const timestamp = parseInt(transaction.timeStamp) * 1000; // Convert seconds to use milliseconds
    const datetime =
      timestamp === 0
        ? GlobalTranslationService.instance.translateInstant('wallet.coin-transaction-status-pending')
        : WalletUtil.getDisplayDate(timestamp);

    const direction = await this.getERC20TransactionDirection(transaction.to);
    transaction.Direction = direction;

    if (direction === TransactionDirection.RECEIVED) {
      this.checkRedPacketTransaction(transaction);
    }

    // internal tx
    if (!transaction.hash && transaction.transactionHash) {
      transaction.hash = transaction.transactionHash;
    }

    const transactionInfo: TransactionInfo = {
      amount: this.getDisplayValue(transaction.value),
      confirmStatus: parseInt(transaction.confirmations),
      datetime,
      direction: direction,
      fee: null,
      height: parseInt(transaction.blockNumber),
      memo: '',
      name: await this.getTransactionName(transaction),
      payStatusIcon: await this.getTransactionIconPath(transaction),
      status: TransactionStatus.UNCONFIRMED, // TODO @zhiming: was: transaction.Status,
      statusName: 'TODO', // TODO @zhiming: was: this.getTransactionStatusName(transaction.Status, translate),
      symbol: '',
      from: transaction.from,
      to: transaction.to,
      timestamp,
      txid: transaction.hash,
      type: null,
      isCrossChain: false,
      isRedPacket: transaction.isRedPacket,
      subOperations: []
    };

    // Use Config.WEI: because the gas is ETHSC.
    if (transaction.gasUsed?.length > 0 && transaction.gasPrice?.length > 0) {
      transactionInfo.fee = new BigNumber(transaction.gasUsed)
        .multipliedBy(new BigNumber(transaction.gasPrice))
        .dividedBy(Config.WEI)
        .toFixed();
    }

    if (transactionInfo.confirmStatus !== 0) {
      transactionInfo.status = TransactionStatus.CONFIRMED;
      transactionInfo.statusName = GlobalTranslationService.instance.translateInstant(
        'wallet.coin-transaction-status-confirmed'
      );
    } else {
      transactionInfo.status = TransactionStatus.PENDING;
      transactionInfo.statusName = GlobalTranslationService.instance.translateInstant(
        'wallet.coin-transaction-status-pending'
      );
    }

    // MESSY again - No "Direction" field in ETH transactions (contrary to other chains). Calling a private method to determine this.
    if (direction === TransactionDirection.RECEIVED) {
      transactionInfo.type = TransactionType.RECEIVED;
      transactionInfo.symbol = '+';
    } else if (direction === TransactionDirection.SENT) {
      transactionInfo.type = TransactionType.SENT;
      transactionInfo.symbol = '-';
    } else if (direction === TransactionDirection.MOVED) {
      transactionInfo.type = TransactionType.TRANSFER;
      transactionInfo.symbol = '';
    }

    // Not blocking retrieval of extended transaction information
    void this.networkWallet.getOrFetchExtendedTxInfo(transaction.hash).then(async extInfo => {
      // Got a partial info, now compute more things (main contract operation type, events...) then save
      if (extInfo && extInfo.evm.transactionReceipt && !extInfo.evm.txInfo) {
        try {
          extInfo.evm.txInfo = await this.txInfoParser.computeFromTxReceipt(
            extInfo.evm.transactionReceipt,
            transaction.input,
            this
          );
          await this.networkWallet.saveExtendedTxInfo(transaction.hash, extInfo);
        } catch (e) {
          // Silent catch
        }
        transactionInfo.name = await this.getTransactionName(transaction);
        transactionInfo.payStatusIcon = await this.getTransactionIconPath(transaction);
      }
    });

    return transactionInfo;
  }

  // TODO: Refine / translate with more detailed info: smart contract run, cross chain transfer or ERC payment, etc
  protected async getTransactionName(transaction: EthTransaction): Promise<string> {
    // Use extended info is there is some
    let extInfo = await this.networkWallet.getExtendedTxInfo(transaction.hash);
    if (extInfo && extInfo.evm && extInfo.evm.txInfo && extInfo.evm.txInfo.operation)
      return GlobalTranslationService.instance.translateInstant(
        extInfo.evm.txInfo.operation.description,
        extInfo.evm.txInfo.operation.descriptionTranslationParams
      );

    const direction = transaction.Direction
      ? transaction.Direction
      : await this.getERC20TransactionDirection(transaction.to);
    switch (direction) {
      case TransactionDirection.RECEIVED:
        return 'wallet.coin-op-received-token';
      case TransactionDirection.SENT:
        return 'wallet.coin-op-sent-token';
      default:
        return 'Invalid';
    }
  }

  // TODO: Refine with more detailed info: smart contract run, cross chain transfer or ERC payment, etc
  protected async getTransactionIconPath(transaction: EthTransaction): Promise<string> {
    const direction = transaction.Direction
      ? transaction.Direction
      : await this.getERC20TransactionDirection(transaction.to);
    if (direction === TransactionDirection.RECEIVED) {
      if (transaction.isRedPacket) {
        return './assets/wallet/tx/redpacket.svg';
      } else {
        return './assets/wallet/buttons/curcol-receive.svg';
      }
    } else if (direction === TransactionDirection.SENT) {
      return './assets/wallet/tx/send.svg';
    } else if (direction === TransactionDirection.MOVED) {
      return './assets/wallet/tx/transfer.svg';
    }

    return null;
  }

  public createWithdrawTransaction(
    toAddress: string,
    amount: number,
    memo: string,
    gasPrice: string,
    gasLimit: string,
    nonceArg: number
  ): Promise<any> {
    return Promise.resolve([]);
  }

  /**
   * IMPORTANT NOTES:
   * We use a fake amount of 1 token (minimal value after decimals conversion) just to estimate
   * the transfer cost.
   * 0 doesn't simulate a transaction creation so the gas estimation is wrong. Must be >0
   *
   * We use the real token owner address because cost estimation works only when "from" actually owns
   * tokens. Otherwise, it simulates a "failed transfer / not enough tokens" call.
   */
  public async estimateTransferTransactionGas() {
    const tokenAccountAddress = this.getTokenAccountAddress();
    const contractAddress = this.coin.getContractAddress();
    const highPriorityWeb3 = await this.createWeb3(true); // Create fresh high-priority web3 instance to get latest RPC URL
    const erc20Contract = new highPriorityWeb3.eth.Contract(this.erc20ABI, contractAddress, {
      from: tokenAccountAddress
    });
    let toAddress = '0x298163B65453Dcd05418A9a5333E4605eDA6D998'; // Fake address, doesn't impact the transfer cost
    const method = erc20Contract.methods.transfer(toAddress, highPriorityWeb3.utils.toBN(1));

    let gasLimit = 100000;
    try {
      // Estimate gas cost
      let gasTemp = await method.estimateGas();
      // '* 1.5': Make sure the gaslimit is big enough.
      gasLimit = Util.ceil(gasTemp * 1.5);
    } catch (error) {
      Logger.log('wallet', 'estimateGas error:', error);
    }
    return gasLimit;
  }

  public async createPaymentTransaction(
    toAddress: string,
    amount: BigNumber,
    memo: string,
    gasPriceArg: string = null,
    gasLimitArg: string = null,
    nonceArg = -1
  ): Promise<any> {
    toAddress = await this.networkWallet.convertAddressForUsage(toAddress, AddressUsage.EVM_CALL);

    const tokenAccountAddress = this.getTokenAccountAddress();
    const contractAddress = this.coin.getContractAddress();
    const highPriorityWeb3 = await this.createWeb3(true); // Create fresh high-priority web3 instance to get latest RPC URL
    const erc20Contract = new highPriorityWeb3.eth.Contract(this.erc20ABI, contractAddress, {
      from: tokenAccountAddress
    });
    let gasPrice = gasPriceArg;
    if (gasPrice == null) {
      gasPrice = await highPriorityWeb3.eth.getGasPrice();
    }

    Logger.log('wallet', 'createPaymentTransaction toAddress:', toAddress, ' amount:', amount, 'gasPrice:', gasPrice);
    // Convert the Token amount (ex: 20 TTECH) to contract amount (=token amount (20) * 10^decimals)
    let amountWithDecimals: BigNumber;
    if (amount.eq(-1)) {
      //-1: send all.
      amountWithDecimals = this.balance;
    } else {
      amountWithDecimals = new BigNumber(amount).multipliedBy(this.tokenAmountMulipleTimes);
    }

    // Incompatibility between our bignumber lib and web3's BN lib. So we must convert by using intermediate strings
    const web3BigNumber = highPriorityWeb3.utils.toBN(amountWithDecimals.toString(10));
    const method = erc20Contract.methods.transfer(toAddress, web3BigNumber);

    let gasLimit = gasLimitArg;
    if (gasLimit == null) {
      gasLimit = (await this.estimateTransferTransactionGas()).toString();
    }

    let nonce = await this.getNonce();
    return (this.networkWallet.safe as unknown as EVMSafe).createContractTransaction(
      contractAddress,
      '0',
      gasPrice,
      gasLimit,
      nonce,
      method.encodeABI()
    );
  }

  public publishTransaction(signedTransaction: string, visualFeedback = true): Promise<string> {
    return this.networkWallet.publishTransaction(this, signedTransaction, visualFeedback);
  }

  /**
   * Returns the current gas price on chain.
   */
  public async getGasPrice(): Promise<string> {
    const highPriorityWeb3 = await this.createWeb3(true); // Create fresh high-priority web3 instance to get latest RPC URL
    const gasPrice = await highPriorityWeb3.eth.getGasPrice();
    // Logger.log('wallet', "GAS PRICE: ", gasPrice)
    return gasPrice;
  }

  private getNonce() {
    const address = this.getTokenAccountAddress();
    try {
      return GlobalEthereumRPCService.instance.getETHSCNonce(
        this.networkWallet.network.getSelectedRpcUrl(),
        address,
        this.networkWallet.network.key
      );
    } catch (err) {
      Logger.error('wallet', 'getNonce failed, ', this.id, ' error:', err);
    }
    return -1;
  }

  /* TODO private async removeInvalidTransaction(hash: string): Promise<void> {
      let existingIndex = (this.paginatedTransactions.txhistory as EthTransaction[]).findIndex(i => i.hash == hash);
      if (existingIndex >= 0) {
        Logger.warn('wallet', 'Found invalid transaction, remove it ', hash);
        this.paginatedTransactions.txhistory.splice(existingIndex, 1);
        this.paginatedTransactions.totalcount--;

        this.transactionsCache.remove(hash);
        this.masterWallet.walletManager.subwalletTransactionStatus.set(this.subwalletTransactionStatusID, this.paginatedTransactions.txhistory.length)
        await this.transactionsCache.save();
      }
    } */

  public getSwapInputCurrency(): string {
    return this.coin.getContractAddress();
  }

  // For FRC759 token on fusion network, We can only transfer parent token.
  public setHasParentWallet(hasParentWallet: boolean) {
    this.hasParentWallet = hasParentWallet;
  }
}
