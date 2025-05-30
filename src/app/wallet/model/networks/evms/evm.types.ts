import { TransferType } from "../../../services/cointransfer.service";
import { TokenType } from "../../coin";
import { GenericTransaction, TransactionDirection } from "../../tx-providers/transaction.types";

// TODO: rename to "evm", not "eth"
export type EthTransaction = GenericTransaction & {
  // Returned from rpc
  blockHash: string;
  blockNumber: string;
  confirmations: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  from: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  hash: string;
  index?: string; // Internal transaction
  input: string;
  isError: string;
  logIndex?: string;
  nonce: string;
  timeStamp: string; // Unix timestamp, seconds
  to: string;
  transactionHash?: string; // Internal transaction
  transactionIndex: string;
  txreceipt_status: string;
  type?: string;
  value: string;

  // Computed
  Direction?: TransactionDirection;
  isERC20TokenTransfer?: boolean;
  hide?: boolean;
  isRedPacket?: boolean;
  isCrossChain?: boolean;
};

// TODO: move to elastos network
export type ElastosSCEthTransaction = EthTransaction & {
  transferType: TransferType;
}

/**
 * Signed ETHSC transaction
 */
export type SignedETHSCTransaction = {
  Fee: string,
  Hash: string,
  TxSigned: string,
  Unit: number
};

// Returned by rpc,
export type EthTokenTransaction = EthTransaction & {
  tokenSymbol: string;
  tokenName: string;
  tokenDecimal: string;
  tokenID?: string; // For NFTs
}

// Show the erc20 token info if the ETHSC transaction is a erc20 token transfer.
export type ERC20TokenTransactionInfo = {
  to: string;
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenValue: string;
}

/**
 * Information about ERC20 or NFT Token
 */
export type ERCTokenInfo = {
  type: TokenType;
  symbol: string;
  name: string;
  decimals: string;
  contractAddress: string;
  balance: string; // Number of ERC20 coins owned, or number of NFT assets of this NFT type (having the same contract address)
  hasOutgoTx: boolean;
  tokenIDs?: string[]; // For NFTs - list of all tokens IDs owned, for this NFT contract address
}

// To speedup eth transactions.
export enum ETHTransactionStatus {
  CANCEL = 'cancel',
  PACKED = 'packed',
  UNPACKED = 'unpacked',
  ERROR = 'error'
}

export enum ETHSCTransferType {
  DEPOSIT = "crossChainEthDeposit",
  TRANSFER = "ethTransfer",
  WITHDRAW = "crossChainEthWithdraw"
}

export enum TransactionListType {
  NORMAL = 0,
  INTERNAL = 1, // contract internal transaction.
}

export enum EtherscanAPIVersion {
  V1 = 0,
  V2 = 1,
}