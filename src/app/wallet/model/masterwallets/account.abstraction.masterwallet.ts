import { WalletJSSDKHelper } from "../networks/elastos/wallet.jssdk.helper";
import { EVMNetwork } from "../networks/evms/evm.network";
import { AnyNetwork } from "../networks/network";
import { MasterWallet } from "./masterwallet";
import { SerializedAccountAbstractionMasterWallet } from "./wallet.types";

/**
 * One AA master wallet can work only on ONE chain (network wallet).
 */
export class AccountAbstractionMasterWallet extends MasterWallet {
  public controllerWalletId: string;
  public chainId: number;
  public isDeployed: boolean;

  public static newFromSerializedWallet(
    serialized: SerializedAccountAbstractionMasterWallet
  ): AccountAbstractionMasterWallet {
    let masterWallet = new AccountAbstractionMasterWallet();

    // Base type deserialization
    masterWallet.deserialize(serialized);

    return masterWallet;
  }

  public async destroy() {
    // Destroy the wallet in the wallet js sdk if it exists
    try {
      await WalletJSSDKHelper.destroyWallet(this.id);
    } catch (e) {
      // Wallet might not exist in JS SDK, ignore error
    }
  }

  protected deserialize(serialized: SerializedAccountAbstractionMasterWallet) {
    super.deserialize(serialized);

    this.controllerWalletId = serialized.controllerMasterWalletId;
    this.chainId = serialized.chainId;
    this.isDeployed = serialized.isDeployed;
  }

  public serialize(): SerializedAccountAbstractionMasterWallet {
    let serialized: SerializedAccountAbstractionMasterWallet =
      {} as SerializedAccountAbstractionMasterWallet;

    super._serialize(serialized as SerializedAccountAbstractionMasterWallet);

    serialized.controllerMasterWalletId = this.controllerWalletId;
    serialized.chainId = this.chainId;
    serialized.isDeployed = this.isDeployed;

    return serialized;
  }

  public hasMnemonicSupport(): boolean {
    return false; // AA wallets don't have mnemonics, they're controlled by other wallets
  }

  public supportsNetwork(network: AnyNetwork): boolean {
    // AA wallets are only supported on EVM networks
    if (!network.isEVMNetwork()) {
      return false;
    }

    const evmNetwork = network as EVMNetwork;

    if (evmNetwork.getMainChainID() !== this.chainId) {
      return false;
    }

    return true;
  }

  /**
   * Get the controller wallet that manages this AA wallet
   */
  public getControllerWalletId(): string {
    return this.controllerWalletId;
  }

  /**
   * Get the chain ID where this AA wallet exists
   */
  public getChainId(): number {
    return this.chainId;
  }

  /**
   * Check if this AA wallet is deployed on-chain
   */
  public isWalletDeployed(): boolean {
    return this.isDeployed;
  }
}
