import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { parseUnits } from 'ethers/lib/utils';
import { Logger } from 'src/app/logger';
import { JsonRpcResponse } from '../../model/json-rpc';
import { UserOperation } from './model/user-operation';

type EstimateUserOpGasResponse = JsonRpcResponse<{
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
}>;

@Injectable({
  providedIn: 'root'
})
export class BundlerService {
  public static instance: BundlerService;

  constructor(private http: HttpClient) {
    BundlerService.instance = this;
  }

  /**
   * Asks the bundler to estimate the gas for a user operation.
   */
  public async estimateUserOpGas(
    bundlerUrl: string,
    partialUserOp: Omit<UserOperation, 'signature'>,
    entryPoint: string
  ): Promise<{ preVerificationGas: string; verificationGasLimit: string; callGasLimit: string }> {
    try {
      // const body = {
      //   jsonrpc: '2.0',
      //   id: 1,
      //   method: 'eth_estimateUserOperationGas',
      //   params: [
      //     /* user op + dummy signature.
      //      TODO: apparently the dummy signature must still have the same length are real signatures */ {
      //       ...partialUserOp,
      //       signature: '0x'
      //     },
      //     entryPoint
      //   ]
      // };
      // const response = await this.http
      //   .post<EstimateUserOpGasResponse>(bundlerUrl, body, {
      //     headers: { 'content-type': 'application/json' }
      //   })
      //   .toPromise();

      // if (!response?.result) {
      //   Logger.error('wallet', response?.error);
      //   throw new Error('No valid result returned by estimateUserOpGas response');
      // }

      // const result = response.result;
      // return {
      //   preVerificationGas: result.preVerificationGas,
      //   verificationGasLimit: result.verificationGasLimit,
      //   callGasLimit: result.callGasLimit
      // };
      return {
        // TMP WHILE ESTIMATE COST IS NOT RIGHT
        preVerificationGas: parseUnits('50', 'gwei').toHexString(),
        verificationGasLimit: parseUnits('50', 'gwei').toHexString(),
        callGasLimit: parseUnits('50', 'gwei').toHexString()
      };
    } catch (error) {
      Logger.error('wallet', error);
      throw new Error('Failed to estimate user operation gas');
    }
  }

  public async sendUserOpToBundler(userOp: UserOperation, entryPoint: string, bundlerUrl: string): Promise<string> {
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_sendUserOperation', params: [userOp, entryPoint] };
    const response = await this.http
      .post<JsonRpcResponse<string>>(bundlerUrl, body, { headers: { 'content-type': 'application/json' } })
      .toPromise();

    if (!response?.result) {
      Logger.error('wallet', response?.error);
      throw new Error('No valid result returned by sendUserOpToBundler response');
    }

    return response.result; // txid
  }
}
