import { LedgerMasterWallet } from "../../../masterwallets/ledger.masterwallet";
import { MasterWallet, StandardMasterWallet } from "../../../masterwallets/masterwallet";
import { WalletType } from "../../../masterwallets/wallet.types";
import { NetworkAPIURLType } from "../../base/networkapiurltype";
import { AnyNetworkWallet } from "../../base/networkwallets/networkwallet";
import { EVMNetwork } from "../../evms/evm.network";
import { AvalancheCChainAPI, AvalancheCChainApiType } from "./avalanchecchain.api";

export abstract class AvalancheCChainBaseNetwork extends EVMNetwork {
  protected async newNetworkWallet(masterWallet: MasterWallet): Promise<AnyNetworkWallet> {
    switch (masterWallet.type) {
      case WalletType.STANDARD:
        const AvalancheCChainNetworkWallet = (await import("../networkwallets/standard/avalanchecchain.network.wallet")).AvalancheCChainNetworkWallet;
        return new AvalancheCChainNetworkWallet(
          masterWallet as StandardMasterWallet,
          this,
          this.getMainTokenSymbol(),
          this.mainTokenFriendlyName
        );
      case WalletType.LEDGER:
        const AvalancheCChainLedgerNetworkWallet = (await import("../networkwallets/ledger/avalanchecchain.ledger.network.wallet")).AvalancheCChainLedgerNetworkWallet;
        return new AvalancheCChainLedgerNetworkWallet(
          masterWallet as LedgerMasterWallet,
          this,
          this.getMainTokenSymbol(),
          this.mainTokenFriendlyName
        );
      default:
        return null;
    }
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC)
      return AvalancheCChainAPI.getApiUrl(AvalancheCChainApiType.RPC, this.networkTemplate);
    // else if (type === NetworkAPIURLType.COVALENTHQ)
    //   return CovalentHelper.apiUrl();
    else if (type === NetworkAPIURLType.ETHERSCAN)
      return AvalancheCChainAPI.getApiUrl(AvalancheCChainApiType.ETHERSCAN_API, this.networkTemplate);
    else if (type === NetworkAPIURLType.BLOCK_EXPLORER)
      return AvalancheCChainAPI.getApiUrl(AvalancheCChainApiType.BLOCK_EXPLORER, this.networkTemplate);
    else
      throw new Error(`AvalancheCChainBaseNetwork: getAPIUrlOfType() has no entry for url type ${type.toString()}`);
  }

  public getMainColor(): string {
    return "e84142";
  }
}
