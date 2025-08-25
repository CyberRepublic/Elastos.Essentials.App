import { Transfer } from "../../../../services/cointransfer.service";
import { SafeService } from "../../../../services/safe.service";
import { MasterWallet } from "../../../masterwallets/masterwallet";
import { Safe } from "../../../safes/safe";
import { SignTransactionResult } from "../../../safes/safe.types";
import { AnySubWallet } from "../../base/subwallets/subwallet";

/**
 * Safe specialized for Account Abstraction wallets
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
    // They use the deployed contract address
    return [];
  }

  public async signTransaction(
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

  /**
   * Get deployed address for a specific network
   */
  public getDeployedAddress(networkKey: string): string | null {
    return this.safeService.getAADeployedAddress(
      this.masterWallet.id,
      networkKey
    );
  }

  /**
   * Check if wallet is deployed on a specific network
   */
  public isDeployed(networkKey: string): boolean {
    return this.safeService.isAAWalletDeployed(
      this.masterWallet.id,
      networkKey
    );
  }

  /**
   * Update deployed address for a network
   */
  public async updateDeployedAddress(
    networkKey: string,
    deployedAddress: string,
    implementationAddress?: string,
    deploymentTxHash?: string
  ): Promise<void> {
    await this.safeService.updateAADeployedAddress(
      this.masterWallet.id,
      networkKey,
      deployedAddress,
      implementationAddress,
      deploymentTxHash
    );
  }

  /**
   * Get all deployed addresses across networks
   */
  public getAllDeployedAddresses(): { [networkKey: string]: string } {
    const safe = this.safeService.getAASafe(this.masterWallet.id);
    return { ...safe.deployedAddresses };
  }
}
