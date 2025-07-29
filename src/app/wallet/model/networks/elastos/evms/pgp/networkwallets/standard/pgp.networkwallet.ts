import { Logger } from "src/app/logger";
import { AnySubWallet } from "src/app/wallet/model/networks/base/subwallets/subwallet";
import { EVMNetwork } from "src/app/wallet/model/networks/evms/evm.network";
import { StandardCoinName } from "../../../../../../coin";
import { StandardMasterWallet } from "../../../../../../masterwallets/masterwallet";
import { TransactionProvider } from "../../../../../../tx-providers/transaction.provider";
import { WalletAddressInfo } from "../../../../../base/networkwallets/networkwallet";
import { ElastosStandardEVMNetworkWallet } from "../../../networkwallets/standard/standard.evm.networkwallet";
import { ElastosEVMSubWallet } from "../../../subwallets/standard/elastos.evm.subwallet";
import { PGPSubWallet } from "../../subwallets/pgp.evm.subwallet";
import { ElastosPGPChainTransactionProvider } from "../../tx-providers/elastos.pgp.tx.provider";

export class ElastosPGPChainStandardNetworkWallet extends ElastosStandardEVMNetworkWallet {
  constructor(masterWallet: StandardMasterWallet, network: EVMNetwork) {
    super(
      masterWallet,
      network,
      "PGA",
      "PGP Chain"
    );
  }

  protected createTransactionDiscoveryProvider(): TransactionProvider<any> {
    return new ElastosPGPChainTransactionProvider(this);
  }

  protected prepareStandardSubWallets(): Promise<void> {
    try {
      this.mainTokenSubWallet = new PGPSubWallet(this);
      this.subWallets[StandardCoinName.ETHECOPGP] = this.mainTokenSubWallet;
    }
    catch (err) {
      Logger.error("wallet", "Can not Create PGP subwallets ", err);
    }
    return Promise.resolve();
  }

  public getAddresses(): WalletAddressInfo[] {
    let addresses = [];

    if (this.subWallets[StandardCoinName.ETHECOPGP]) {
      addresses.push({
        title: "EVM",
        address: this.subWallets[StandardCoinName.ETHECOPGP].getCurrentReceiverAddress()
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