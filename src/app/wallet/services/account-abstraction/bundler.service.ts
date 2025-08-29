import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UserOperation } from './model/user-operation';

type EstimateUserOpGasResponse = {
  result: {
    preVerificationGas: string;
    verificationGasLimit: string;
    callGasLimit: string;
  };
};

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
    const dummySigOp = { ...partialUserOp, signature: '0x' };
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_estimateUserOperationGas', params: [dummySigOp, entryPoint] };
    const response = await this.http
      .post<EstimateUserOpGasResponse>(bundlerUrl, body, {
        headers: { 'content-type': 'application/json' }
      })
      .toPromise();

    const result = response.result;
    return {
      preVerificationGas: result.preVerificationGas,
      verificationGasLimit: result.verificationGasLimit,
      callGasLimit: result.callGasLimit
    };
  }

  public async sendUserOpToBundler(userOp: UserOperation, entryPoint: string, bundlerUrl: string): Promise<string> {
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_sendUserOperation', params: [userOp, entryPoint] };
    const response = await this.http
      .post<string>(bundlerUrl, body, { headers: { 'content-type': 'application/json' } })
      .toPromise();
    return response; // UserOp hash as txid
  }
}
