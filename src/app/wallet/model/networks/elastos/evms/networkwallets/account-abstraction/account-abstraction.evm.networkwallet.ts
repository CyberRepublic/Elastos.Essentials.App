import { AccountAbstractionMasterWallet } from 'src/app/wallet/model/masterwallets/account.abstraction.masterwallet';
import { TransactionProvider } from 'src/app/wallet/model/tx-providers/transaction.provider';
import { AccountAbstractionNetworkWallet } from '../../../../evms/networkwallets/account-abstraction.networkwallet';
import { AASafe } from '../../../../evms/safes/aa.safe';
import { ElastosEVMNetwork } from '../../../network/elastos.evm.network';

export class ElastosAccountAbstractionEVMNetworkWallet extends AccountAbstractionNetworkWallet {
  constructor(masterWallet: AccountAbstractionMasterWallet, network: ElastosEVMNetwork<any>) {
    super(masterWallet, network, new AASafe(masterWallet), 'ELA', network.name);
  }

  public createTransactionDiscoveryProvider(): TransactionProvider<any> {
    return null;
  }
}
