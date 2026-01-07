import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { environment } from 'src/environments/environment';
import { Logger } from '../logger';
import {
  AddressResult,
  BalanceHistory,
  BTCNetworkInfoResult,
  BTCTransaction,
  BTCUTXO
} from '../wallet/model/btc.types';
import { GlobalJsonRPCService } from './global.jsonrpc.service';
import { NownodeEVMToken, NownodeEVMTransaction } from '../wallet/model/nownode.types';

export enum BTCFeeSpeed {
  FAST = 1, // 1 block
  AVERAGE = 3, // 3 block
  SLOW = 6, // 6 block
  CUSTOM = -1 // Custom fee rate set by user
}

@Injectable({
  providedIn: 'root'
})
export class GlobalBTCRPCService {
  public static instance: GlobalBTCRPCService = null;
  private apikey = `${environment.NownodesAPI.apikey}`;

  constructor(private http: HttpClient, private globalJsonRPCService: GlobalJsonRPCService) {
    GlobalBTCRPCService.instance = this;
  }

  // EXPLORER api
  public async balancehistory(rpcApiUrl: string, address: string): Promise<BigNumber> {
    let requestUrl = rpcApiUrl + '/api/v2/balancehistory/' + address;

    try {
      let balanceArray: BalanceHistory[] = await this.httpGet(requestUrl);
      if (balanceArray instanceof Array) {
        //TODO: the address is not array.
        return new BigNumber(balanceArray[0].received);
      }
      return null;
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'balancehistory: http get error:', err);
      return null;
    }
  }

  // EXPLORER api
  public async address(rpcApiUrl: string, address: string, pageSize: number, page = 1): Promise<AddressResult> {
    // address/<address>[?page=<page>&pageSize=<size>&from=<block height>&to=<block height>&details=<basic|tokens|tokenBalances|txids|txs>&contract=<contract address>]
    let requestUrl = rpcApiUrl + '/api/v2/address/' + address + '?pageSize=' + pageSize + '&page=' + page;

    try {
      let balanceArray: AddressResult = await this.httpGet(requestUrl);
      return balanceArray;
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'address: http get error:', err);
      return null;
    }
  }

  // public async getrawtransaction(rpcApiUrl: string, txid: string): Promise<BTCTransaction> {
  //     let requestUrl = rpcApiUrl + '/api/v2/tx-specific/' + txid;

  //     try {
  //         return await this.httpGet(requestUrl);
  //     }
  //     catch (err) {
  //         Logger.error('GlobalBTCRPCService', 'getrawtransaction: http get error:', err);
  //         return null;
  //     }
  // }

  // EXPLORER api
  public async getrawtransaction(rpcApiUrl: string, txid: string): Promise<BTCTransaction> {
    let requestUrl = rpcApiUrl + '/api/v2/tx/' + txid;

    try {
      return await this.httpGet(requestUrl);
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getrawtransaction: http get error:', err);
      return null;
    }
  }

  // EXPLORER api
  public async getUTXO(rpcApiUrl: string, address: string): Promise<BTCUTXO[]> {
    let requestUrl = rpcApiUrl + '/api/v2/utxo/' + address + '?confirmed=true';

    try {
      return await this.httpGet(requestUrl);
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getUTXO: http get error:', err);
      return null;
    }
  }

  // EXPLORER api for EVM networks - Get address info with txids list
  // Similar to BTC address() method, returns address info including txids array
  // Note: BlockBook API for EVM chains does NOT support details=txs parameter (returns Internal Server Error)
  // We use default behavior (no details parameter) which returns txids, then fetch each transaction separately
  public async getEVMAddressInfo(rpcApiUrl: string, address: string, pageSize: number, page = 1): Promise<{ txids: string[] } | null> {
    // nownode BlockBook API format: /api/v2/address/{address}?pageSize={size}&page={page}
    // Do NOT use details=txs as it causes Internal Server Error for EVM chains
    let requestUrl = rpcApiUrl + '/api/v2/address/' + address + '?pageSize=' + pageSize + '&page=' + page;

    try {
      let addressResult = await this.httpGet(requestUrl);
      Logger.log('GlobalBTCRPCService', 'getEVMAddressInfo response:', addressResult);

      if (addressResult && addressResult.txids && Array.isArray(addressResult.txids)) {
        return { txids: addressResult.txids };
      }
      return { txids: [] };
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getEVMAddressInfo: http get error:', err);
      return null;
    }
  }

  // EXPLORER api for EVM networks
  // Get address transactions using nownode API
  // Returns transactions in a format compatible with Etherscan API response
  // Note: This method is kept for backward compatibility, but prefer using getEVMAddressInfo + getEVMTransactionByHash
  public async getEVMAddressTransactions(rpcApiUrl: string, address: string, pageSize: number, page = 1): Promise<{ result: any[] } | null> {
    // Get address info first
    let addressInfo = await this.getEVMAddressInfo(rpcApiUrl, address, pageSize, page);
    if (!addressInfo || !addressInfo.txids || addressInfo.txids.length === 0) {
      return { result: [] };
    }

    // Fetch transaction details for each txid
    let transactions: any[] = [];
    for (let txid of addressInfo.txids) {
      try {
        let tx = await this.getEVMTransactionByHash(rpcApiUrl, txid);
        if (tx) {
          transactions.push(tx);
        }
      } catch (err) {
        Logger.warn('GlobalBTCRPCService', 'getEVMAddressTransactions: Failed to fetch tx:', txid, err);
      }
    }
    return { result: transactions };
  }

  // Get a single transaction by hash/txid for EVM networks
  public async getEVMTransactionByHash(rpcApiUrl: string, txHash: string): Promise<any> {
    // nownode BlockBook API format: /api/v2/tx/{txHash}
    let requestUrl = rpcApiUrl + '/api/v2/tx/' + txHash;
    // let requestUrl = rpcApiUrl + '/api/v2/tx-specific/' + txHash;

    try {
      let txResult = await this.httpGet(requestUrl);
      if (txResult) {
        return this.convertNownodeTxToEthTransaction(txResult);
      }
      return null;
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getEVMTransactionByHash error:', err);
      return null;
    }
  }

  // EXPLORER api for EVM networks - Get token transactions
  // BlockBook API format: /api/v2/address/{address}?contract={contractAddress}&pageSize={size}&page={page}
  // Similar to BTC address API, use contract parameter to filter by token contract address
  public async getEVMTokenTransactions(rpcApiUrl: string, address: string, contractAddress: string, pageSize: number, page = 1): Promise<{ result: any[] } | null> {
    // nownode BlockBook API format: /api/v2/address/{address}?contract={contractAddress}&pageSize={size}&page={page}
    let requestUrl = rpcApiUrl + '/api/v2/address/' + address + '?contract=' + contractAddress + '&pageSize=' + pageSize + '&page=' + page;

    try {
      let addressResult = await this.httpGet(requestUrl);

      // BlockBook API returns txids array for filtered transactions
      if (addressResult && addressResult.txids && Array.isArray(addressResult.txids) && addressResult.txids.length > 0) {
        // Fetch transaction details for each txid
        let transactions: any[] = [];
        for (let txid of addressResult.txids) {
          try {
            let tx = await this.getEVMTransactionByHash(rpcApiUrl, txid);
            if (tx) {
              // Add contract address to the transaction
              tx.contractAddress = contractAddress;
              transactions.push(this.convertNownodeTokenTxToEthTransaction(tx, contractAddress));
            }
          } catch (err) {
            Logger.warn('GlobalBTCRPCService', 'getEVMTokenTransactions: Failed to fetch tx:', txid, err);
          }
        }
        return { result: transactions };
      } else if (addressResult && addressResult.txs && Array.isArray(addressResult.txs)) {
        // If transactions are already included in the response
        let transactions = addressResult.txs.map((tx: any) => this.convertNownodeTokenTxToEthTransaction(tx, contractAddress));
        return { result: transactions };
      }
      return { result: [] };
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getEVMTokenTransactions: http get error:', err);
      return null;
    }
  }

  // EXPLORER api for EVM networks - Get token list for an address
  public async getEVMTokenList(rpcApiUrl: string, address: string): Promise<NownodeEVMToken[]> {
    // Check if address is valid
    if (!address || address.trim() === '') {
      Logger.error('GlobalBTCRPCService', 'getEVMTokenList: Invalid address provided:', address);
      return null;
    }

    let requestUrl = rpcApiUrl + '/api/v2/address/' + address + '?details=tokens';

    try {
      let result = await this.httpGet(requestUrl);
      if (result && Array.isArray(result.tokens)) {
        return result.tokens;
      }

      // If no tokens in response, return empty array
      // Token discovery for EVM chains via BlockBook may not be fully supported
      Logger.warn('GlobalBTCRPCService', 'getEVMTokenList: No tokens found in response.');
      return [];
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getEVMTokenList: http get error:', err);
      return [];
    }
  }

  // Convert nownode transaction format to EthTransaction format
  private convertNownodeTxToEthTransaction(tx: NownodeEVMTransaction): any {
    // Extract from/to addresses from vin/vout arrays
    const fromAddress = tx.vin && tx.vin.length > 0 && tx.vin[0].addresses && tx.vin[0].addresses.length > 0
      ? tx.vin[0].addresses[0]
      : '';

    const toAddress = tx.vout && tx.vout.length > 0 && tx.vout[0].addresses && tx.vout[0].addresses.length > 0
      ? tx.vout[0].addresses[0]
      : '';

    // Extract ethereum-specific fields
    const ethSpecific = tx.ethereumSpecific;
    const status = ethSpecific?.status ?? 1; // 1 = success, 0 = failure
    const isError = status === 0 ? '1' : '0';
    const txreceipt_status = status === 1 ? '1' : '0';

    // Extract contract address from token transfers if available
    const contractAddress = tx.tokenTransfers && tx.tokenTransfers.length > 0
      ? tx.tokenTransfers[0].contract
      : '';

    return {
      blockHash: tx.blockHash || '',
      blockNumber: tx.blockHeight?.toString() || '0',
      confirmations: tx.confirmations?.toString() || '0',
      contractAddress: contractAddress,
      cumulativeGasUsed: '0', // Not available in nownode format
      from: fromAddress,
      gas: ethSpecific?.gasLimit?.toString() || '0',
      gasPrice: ethSpecific?.gasPrice || '0',
      gasUsed: ethSpecific?.gasUsed?.toString() || '0',
      hash: tx.txid || '',
      input: ethSpecific?.data || '0x',
      isError: isError,
      nonce: ethSpecific?.nonce?.toString() || '0',
      timeStamp: tx.blockTime ? tx.blockTime.toString() : '0',
      to: toAddress,
      transactionIndex: '0', // Not available in nownode format
      txreceipt_status: txreceipt_status,
      value: tx.value || '0'
    };
  }

  // Convert nownode token transaction format to EthTokenTransaction format
  private convertNownodeTokenTxToEthTransaction(tx: any, contractAddress: string): any {
    let baseTx = this.convertNownodeTxToEthTransaction(tx);
    return {
      ...baseTx,
      contractAddress: contractAddress,
      tokenSymbol: tx.tokenSymbol || '',
      tokenName: tx.tokenName || '',
      tokenDecimal: tx.tokenDecimal?.toString() || '18',
      tokenID: tx.tokenID || undefined
    };
  }

  /**
   * Returns an estimation of the current BTC to pay per transaction kB.
   * Node api.
   *
   * @param feeRate Number of blocks
   * @returns BTC/kB
   */
  public async estimatesmartfee(rpcApiUrl: string, feeRate: BTCFeeSpeed = BTCFeeSpeed.AVERAGE): Promise<number> {
    const param = {
      API_key: this.apikey,
      method: 'estimatesmartfee',
      params: [feeRate],
      jsonrpc: '2.0',
      id: '1'
    };

    let result = null;
    try {
      result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'btc');
      if (result) {
        return result.feerate;
      }
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'estimatesmartfee error:', err);
    }
    return null;
  }

  // Node api
  public async sendrawtransaction(rpcApiUrl: string, signedhex: string): Promise<string> {
    const param = {
      API_key: this.apikey,
      method: 'sendrawtransaction',
      params: [signedhex],
      jsonrpc: '2.0',
      id: '1'
    };

    // The caller handles the exception
    return await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'btc');
  }

  public async getnetworkinfo(rpcApiUrl: string): Promise<BTCNetworkInfoResult> {
    const param = {
      API_key: this.apikey,
      method: 'getnetworkinfo',
      params: [],
      jsonrpc: '2.0',
      id: '1'
    };

    try {
      return await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'btc');
    } catch (err) {
      Logger.error('GlobalBTCRPCService', 'getnetworkinfo error:', err);
    }
    return null;
  }

  httpGet(url): Promise<any> {
    // Use GlobalJsonRPCService instead of Angular HttpClient to avoid CORS issues
    // GlobalJsonRPCService uses Cordova HTTP plugin which doesn't have CORS restrictions
    // Pass api-key in headers for nownode API authentication
    return this.globalJsonRPCService.httpGet(url, 'btc', 10000, {
      'api-key': this.apikey
    });
  }
}
