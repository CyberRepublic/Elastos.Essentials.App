import { Logger } from "src/app/logger";
import { LedgerMasterWallet } from "src/app/wallet/model/masterwallets/ledger.masterwallet";
import { AnySubWallet } from "src/app/wallet/model/networks/base/subwallets/subwallet";
import { EVMNetwork } from "src/app/wallet/model/networks/evms/evm.network";
import { StandardCoinName } from "../../../../../../coin";
import { TransactionProvider } from "../../../../../../tx-providers/transaction.provider";
import { WalletAddressInfo } from "../../../../../base/networkwallets/networkwallet";
import { ElastosLedgerEVMNetworkWallet } from "../../../networkwallets/ledger/ledger.evm.networkwallet";
import { ElastosEVMSubWallet } from "../../../subwallets/standard/elastos.evm.subwallet";
import { EcoSubWallet } from "../../subwallets/eco.evm.subwallet";
import { ElastosECOChainTransactionProvider } from "../../tx-providers/elastos.eco.tx.provider";

export class ElastosECOLedgerNetworkWallet extends ElastosLedgerEVMNetworkWallet {
  constructor(masterWallet: LedgerMasterWallet, network: EVMNetwork) {
    super(
      masterWallet,
      network,
      "ECO",
      "Elastos ECO Chain"
    );
  }

  protected createTransactionDiscoveryProvider(): TransactionProvider<any> {
    return new ElastosECOChainTransactionProvider(this);
  }

  protected prepareStandardSubWallets(): Promise<void> {
    try {
      this.mainTokenSubWallet = new EcoSubWallet(this);
      this.subWallets[StandardCoinName.ETHECO] = this.mainTokenSubWallet;
    }
    catch (err) {
      Logger.error("wallet", "Can not Create Elastos ECO subwallets ", err);
    }

    return;
  }

  public getAddresses(): WalletAddressInfo[] {
    let addresses = [];

    if (this.subWallets[StandardCoinName.ETHECO]) {
      addresses.push({
        title: "EVM",
        address: this.subWallets[StandardCoinName.ETHECO].getCurrentReceiverAddress()
      });
    }
    return addresses;
  }

  public getMainEvmSubWallet(): ElastosEVMSubWallet {
    return this.mainTokenSubWallet as ElastosEVMSubWallet;
  }

  public getMainTokenSubWallet(): AnySubWallet {
    return this.mainTokenSubWallet;
  }

  public getAverageBlocktime(): number {
    return 5;
  }
}