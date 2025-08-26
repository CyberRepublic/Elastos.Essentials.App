import { Transfer } from "../../../../services/cointransfer.service";
import { SafeService } from "../../../../services/safe.service";
import { MasterWallet } from "../../../masterwallets/masterwallet";
import { Safe } from "../../../safes/safe";
import { SignTransactionResult } from "../../../safes/safe.types";
import { AnySubWallet } from "../../base/subwallets/subwallet";

/**
 * Safe specialized for Account Abstraction wallets
 * Note: Address management is now handled by the AA network wallet through the account abstraction service
 */
export class AASafe extends Safe {
  private safeService = SafeService.instance;

  constructor(protected masterWallet: MasterWallet) {
    super(masterWallet);
  }

  public getAddresses(
    startIndex: number,
    count: number,
    internalAddresses: boolean,
    usage: any
  ): string[] {
    // AA wallets don't derive addresses like standard wallets
    // They use the address returned by the AA provider
    return [];
  }

  public signTransaction(
    subWallet: AnySubWallet,
    rawTx: any,
    transfer: Transfer,
    forcePasswordPrompt?: boolean,
    visualFeedback?: boolean
  ): Promise<SignTransactionResult> {
    // AA wallets don't sign transactions directly
    // They use the controller wallet for signing
    throw new Error(
      "AA wallets don't sign transactions directly. Use the controller wallet."
    );
  }
}
