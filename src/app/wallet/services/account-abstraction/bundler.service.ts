import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
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
