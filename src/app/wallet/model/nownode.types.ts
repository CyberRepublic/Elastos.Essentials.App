import { GenericTransaction } from "./tx-providers/transaction.types";

export type NownodeEVMTransactionInObj = {
  txid: string;
  sequence?: number;
  n: number;
  addresses: string[];
  value?: string;
  isAddress: boolean;
  hex?: string;
}

export type NownodeEVMTransactionOutObj = {
  value?: string;
  n: number;
  addresses: string[];
  isAddress: boolean;
}

export type NownodeEVMTransactionTokenTransferObj = {
  type?: string;
  standard: string;
  from: string;
  to: string;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  value: string;
}

export type NownodeEVMTransactionEthereumSpecific = {
  status: number;
  nonce: number;
  gasLimit: number;
  gasUsed: number;
  gasPrice: string;
  data: string;
  parsedData: {
    methodId: string;
    name: string;
  };
}

export type NownodeEVMToken = {
  type: string;
  standard: string;
  name: string;
  contract: string;
  symbol: string;
  decimals: number;
  transfers: number;
}

export type NownodeEVMTransaction = GenericTransaction & {
  txid: string;
  vin: NownodeEVMTransactionInObj[];
  vout: NownodeEVMTransactionOutObj[];
  blockHash: string;
  blockHeight: number;
  confirmations: number;
  blockTime: number;
  value: string;
  fees: string;
  tokenTransfers?: NownodeEVMTransactionTokenTransferObj[];
  ethereumSpecific?: NownodeEVMTransactionEthereumSpecific;
}

