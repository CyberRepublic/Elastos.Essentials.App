import { Config } from "src/app/wallet/config/Config";
import { StandardCoinName } from "../../../../../coin";
import { AnyEVMNetworkWallet } from "../../../../evms/networkwallets/evm.networkwallet";
import { ElastosEVMSubWallet } from "../../subwallets/standard/elastos.evm.subwallet";

export class EcoSubWallet extends ElastosEVMSubWallet {
  constructor(networkWallet: AnyEVMNetworkWallet) {
    super(networkWallet, StandardCoinName.ETHECO, "Elastos ECO Chain");
  }

  public async initialize() {
    await super.initialize();

    this.withdrawContractAddress = Config.ETHECO_WITHDRAW_ADDRESS.toLowerCase();
  }

  public supportInternalTransactions() {
    return true;
  }

  public getCrossChainFee(): number {
    // The minimum gas price set for eco sidechain is 500, The gas limit for cross chain transactions is approximately 21512,
    // so the fee set in the SDK is 1500000.
    return 1500000;
  }
}