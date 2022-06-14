import type { MasterWallet, StandardMasterWallet } from "../../../masterwallets/masterwallet";
import { WalletType } from "../../../masterwallets/wallet.types";
import { NetworkAPIURLType } from "../../base/networkapiurltype";
import type { AnyNetworkWallet } from "../../base/networkwallets/networkwallet";
import { EVMNetwork } from "../../evms/evm.network";
import { FantomAPI, FantomApiType } from "./fantom.api";

export class FantomBaseNetwork extends EVMNetwork {
  protected async newNetworkWallet(masterWallet: MasterWallet): Promise<AnyNetworkWallet> {
    switch (masterWallet.type) {
      case WalletType.STANDARD:
        const FantomNetworkWallet = (await import("../networkwallets/standard/bsc.network.wallet")).FantomNetworkWallet;
        return new FantomNetworkWallet(
          masterWallet as StandardMasterWallet,
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
      return FantomAPI.getApiUrl(FantomApiType.RPC, this.networkTemplate);
    else if (type === NetworkAPIURLType.ETHERSCAN)
      return FantomAPI.getApiUrl(FantomApiType.ETHERSCAN_API, this.networkTemplate);
    else
      throw new Error(`FantomBaseNetwork: getAPIUrlOfType() has no entry for url type ${type.toString()}`);
  }
}