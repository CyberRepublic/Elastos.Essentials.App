export enum SignTransactionErrorType {
  CANCELLED, // eg: password cancellation
  FAILURE, // eg: real signature flow failure with no more details
  DELEGATED // The signature process is delegated to a different flow like for multi signatures. Wallet should not try to publish the transaction result but should not return any error or event
}

/**
 * Result of a transaction signing request to a safe
 */
export type SignTransactionResult = {
  signedTransaction?: any; // often a string, but potentially an object (AA user op with signature inside)
  errorType?: SignTransactionErrorType;
};
