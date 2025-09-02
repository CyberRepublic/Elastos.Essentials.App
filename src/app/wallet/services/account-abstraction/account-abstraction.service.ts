import { Injectable } from '@angular/core';
import { EVMNetwork } from '../../model/networks/evms/evm.network';
import { BaseAccount__factory, EntryPoint__factory, SimpleAccountFactory__factory } from './typechain';

@Injectable({
  providedIn: 'root'
})
export class AccountAbstractionService {
  public static instance: AccountAbstractionService;
  private baseAccountInterface = BaseAccount__factory.createInterface();

  constructor() {
    AccountAbstractionService.instance = this;
  }

  /**
   * Asks the entry point contract to get the nonce for a given sender.
   */
  async getNonce(network: EVMNetwork, entryPoint: string, sender: string): Promise<string> {
    const entryPointContract = EntryPoint__factory.connect(entryPoint, network.getJsonRpcProvider());
    return (await entryPointContract.getNonce(sender, 0)).toHexString();
  }

  /**
   * Asks the account contract to encode a transaction transactions.
   */
  public encodeExecute(target: string, value: string, data: string): string {
    return this.baseAccountInterface.encodeFunctionData('execute', [target, value, data]);
  }

  public async getInitCode(
    network: EVMNetwork,
    aaAddress: string,
    eoaControllerAddress: string,
    factoryAddress: string
  ): Promise<string> {
    const provider = network.getJsonRpcProvider();
    const code = await provider.getCode(aaAddress);
    let initCode = '0x';
    if (code === '0x') {
      const salt = 0;
      const factory = SimpleAccountFactory__factory.connect(factoryAddress, provider);
      const createData = factory.interface.encodeFunctionData('createAccount', [eoaControllerAddress, salt]);
      initCode = factoryAddress + createData.slice(2);
    }
    return initCode;
  }
}
