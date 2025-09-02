import type { ConfigInfo } from '@elastosfoundation/wallet-js-sdk';
import { Logger } from 'src/app/logger';
import { GlobalNetworksService } from 'src/app/services/global.networks.service';
import { LedgerMasterWallet } from 'src/app/wallet/model/masterwallets/ledger.masterwallet';
import { EVMNetwork } from 'src/app/wallet/model/networks/evms/evm.network';
import { StandardCoinName } from '../../../../../../coin';
import { TransactionProvider } from '../../../../../../tx-providers/transaction.provider';
import { ElastosLedgerEVMNetworkWallet } from '../../../networkwallets/ledger/ledger.evm.networkwallet';
import { ElastosEVMSubWallet } from '../../../subwallets/standard/elastos.evm.subwallet';
import { ElastosEVMChainTransactionProvider } from '../../../tx-providers/elastos.evm.tx.provider';
import { ElastosEscMainSubWallet } from '../../subwallets/elastos.esc.main.subwallet';

export class ElastosSmartChainLedgerNetworkWallet extends ElastosLedgerEVMNetworkWallet {
  constructor(masterWallet: LedgerMasterWallet, network: EVMNetwork) {
    super(masterWallet, network, 'ELA', 'Elastos Smart Chain', StandardCoinName.ETHSC);
  }

  protected createTransactionDiscoveryProvider(): TransactionProvider<any> {
    return new ElastosEVMChainTransactionProvider(this, StandardCoinName.ETHSC);
  }

  protected prepareStandardSubWallets(): Promise<void> {
    this.mainTokenSubWallet = new ElastosEscMainSubWallet(this);

    try {
      // TODO: No ETHSC in LRW
      // Remove it if there is ETHSC in LRW.
      let networkConfig: ConfigInfo = {};
      this.network.updateSPVNetworkConfig(networkConfig, GlobalNetworksService.instance.getActiveNetworkTemplate());
      if (networkConfig['ETHSC']) {
        this.subWallets[StandardCoinName.ETHSC] = this.mainTokenSubWallet;
        // await this.subWallets[StandardCoinName.ETHSC].initialize();
      } else {
        this.mainTokenSubWallet = this.subWallets[StandardCoinName.ETHDID] as ElastosEVMSubWallet;
      }

      // Logger.log("wallet", "Elastos standard subwallets preparation completed");
    } catch (err) {
      Logger.error('wallet', 'Can not Create Elastos EVM subwallets ', err);
    }

    return;
  }
}
