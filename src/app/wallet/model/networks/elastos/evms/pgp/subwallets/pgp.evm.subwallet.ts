import { Config } from "src/app/wallet/config/Config";
import { StandardCoinName } from "../../../../../coin";
import { AnyEVMNetworkWallet } from "../../../../evms/networkwallets/evm.networkwallet";
import { ElastosEVMSubWallet } from "../../subwallets/standard/elastos.evm.subwallet";

export class PGPSubWallet extends ElastosEVMSubWallet {
  private withdrawContract: any = null;

  constructor(networkWallet: AnyEVMNetworkWallet) {
    super(networkWallet, StandardCoinName.ETHECOPGP, "PGP Chain");
  }

  public async initialize() {
    await super.initialize();

    this.withdrawContractAddress = Config.ETHECOPGP_WITHDRAW_ADDRESS.toLowerCase();
  }

  public supportInternalTransactions() {
    return true;
  }

  public supportsCrossChainTransfers(): boolean {
    // Only ELA erc20 subwallet can cross chain.
    return false;
  }

  public getCrossChainFee(): number {
    // The minimum gas price set for eco sidechain is 50, The gas limit for cross chain transactions is approximately 21512,
    // so the fee set in the SDK is 150000.
    return 150000;
  }

  public getMainIcon(): string {
    return "assets/wallet/coins/pga.png";
  }
}