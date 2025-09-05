import { AccountAbstractionMasterWallet } from 'src/app/wallet/model/masterwallets/account.abstraction.masterwallet';
import { AccountAbstractionNetworkWallet } from '../../../../evms/networkwallets/account-abstraction.networkwallet';
import { AASafe } from '../../../../evms/safes/aa.safe';
import { ElastosEVMNetwork } from '../../../network/elastos.evm.network';

export abstract class ElastosAccountAbstractionEVMNetworkWallet extends AccountAbstractionNetworkWallet {
  constructor(masterWallet: AccountAbstractionMasterWallet, network: ElastosEVMNetwork<any>) {
    super(masterWallet, network, new AASafe(masterWallet), 'ELA', network.name);
  }
}
