import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { EVMNetwork } from '../../model/networks/evms/evm.network';
import { AccountAbstractionTransaction } from './model/account-abstraction-transaction';
import { BaseAccount__factory, EntryPoint__factory, SimpleAccountFactory__factory } from './typechain';
import { PackedUserOperationStruct } from './typechain/contracts/accounts/SimpleAccount';

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
   * Asks the account contract to encode a batch of transactions.
   */
  public encodeExecuteBatch(calls: AccountAbstractionTransaction[]): string {
    return this.baseAccountInterface.encodeFunctionData('executeBatch', [
      calls.map(c => ({ target: c.to, value: c.value, data: c.data }))
    ]);
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

  /**
   *
   * @param network
   * @param userOp
   * @param entryPoint
   * @returns
   */
  public getUserOpHash(
    network: EVMNetwork,
    userOp: Omit<PackedUserOperationStruct, 'signature' | 'paymasterAndData'>,
    entryPoint: string
  ): Promise<string> {
    const entryPointContract = EntryPoint__factory.connect(entryPoint, network.getJsonRpcProvider());
    return entryPointContract.getUserOpHash({ ...userOp, signature: '0x', paymasterAndData: '0x' });
  }

  async signUserOp(
    userOpHash: string,
    privateKey: string,
    provider: ethers.providers.JsonRpcProvider
  ): Promise<string> {
    const signer = new ethers.Wallet(privateKey, provider);
    return await signer.signMessage(ethers.utils.arrayify(userOpHash));
  }
}
