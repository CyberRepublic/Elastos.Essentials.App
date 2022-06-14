// eslint-disable-next-line @typescript-eslint/no-var-requires
import type { Transaction as EthereumTx, TxData } from "@ethereumjs/tx";
import { lazyWeb3Import } from "src/app/helpers/import.helper";
import BluetoothTransport from "src/app/helpers/ledger/hw-transport-cordova-ble/src/BleTransport";
import { Logger } from "src/app/logger";
import { Transfer } from "src/app/wallet/services/cointransfer.service";
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { WalletUIService } from "src/app/wallet/services/wallet.ui.service";
import { LedgerAccountType } from "../../../ledger.types";
import { LedgerMasterWallet } from "../../../masterwallets/ledger.masterwallet";
import { LedgerSafe } from "../../../safes/ledger.safe";
import { SignTransactionResult } from "../../../safes/safe.types";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { EVMSafe } from "./evm.safe";

/**
 * Safe specialized for EVM networks, with additional methods.
 */
export class EVMLedgerSafe extends LedgerSafe implements EVMSafe {
    private evmAddress = null;
    private addressPath = '';
    private evmTx: EthereumTx = null;

    constructor(protected masterWallet: LedgerMasterWallet, protected chainId: number) {
        super(masterWallet);

        this.initEVMAddress();
    }

    initEVMAddress() {
        if (this.masterWallet.accountOptions) {
            let evmOption = this.masterWallet.accountOptions.find((option) => {
                return option.type === LedgerAccountType.EVM
            })
            if (evmOption) {
                this.evmAddress = evmOption.accountID;
                this.addressPath = evmOption.accountPath;
            }
        }
    }

    public getAddresses(startIndex: number, count: number, internalAddresses: boolean): Promise<string[]> {
        if (this.evmAddress) {
            return Promise.resolve([this.evmAddress]);
        }
        else {
            throw new Error("EVMSafe: No evm address.");
        }
    }

    public async createTransferTransaction(toAddress: string, amount: string, gasPrice: string, gasLimit: string, nonce: number): Promise<any> {
        const Web3 = await lazyWeb3Import();
        let web3 = new Web3();
        const txData: TxData = {
            nonce: web3.utils.toHex(nonce),
            gasLimit: web3.utils.toHex(gasLimit),
            gasPrice: web3.utils.toHex(gasPrice),
            to: toAddress,
            value: web3.utils.toHex(web3.utils.toWei(amount.toString())),
        }
        Logger.log('wallet', 'EVMSafe::createTransferTransaction:', txData);
        return Promise.resolve(txData);
    }

    public createContractTransaction(contractAddress: string, amount: string, gasPrice: string, gasLimit: string, nonce: number, data: any): Promise<any> {
        return EVMService.instance.createUnsignedContractTransaction(contractAddress, amount, gasPrice, gasLimit, nonce, data);
    }

    public personalSign(): string {
        throw new Error("Method not implemented.");
    }

    public async signTransaction(subWallet: AnySubWallet, txData: TxData, transfer: Transfer): Promise<SignTransactionResult> {
        Logger.log('ledger', "EVMSafe::signTransaction chainId:", this.chainId);
        let signTransactionResult: SignTransactionResult = {
            signedTransaction: null
        }

        await this.createEthereumTx(txData)

        // Wait for the ledger sign the transaction.
        let signed = await WalletUIService.instance.connectLedgerAndSignTransaction(this.masterWallet.deviceID, this)
        if (!signed) {
            Logger.log('ledger', "EVMSafe::signTransaction can't connect to ledger or user canceled");
            return signTransactionResult;
        }

        signTransactionResult.signedTransaction = this.evmTx.serialize().toString('hex');
        return signTransactionResult;
    }

    public async signTransactionByLedger(transport: BluetoothTransport): Promise<void> {
        Logger.log('ledger', "EVMSafe::signTransactionByLedger");
        let unsignedTx = this.evmTx.serialize().toString('hex')

        const AppEth = (await import("@ledgerhq/hw-app-eth")).default;
        const eth = new AppEth(transport);
        // TODO: use the right HD derivation path.
        const r = await eth.signTransaction(this.addressPath, unsignedTx);

        const Transaction = (await import("@ethereumjs/tx")).Transaction;
        this.evmTx = new Transaction({
            v: Buffer.from(r.v, "hex"),
            r: Buffer.from(r.r, "hex"),
            s: Buffer.from(r.s, "hex")
        });
    }

    private async createEthereumTx(txData: TxData): Promise<void> {
        const Common = (await import('@ethereumjs/common')).default;
        let common = Common.forCustomChain(
            'mainnet',
            { chainId: this.chainId },
            'petersburg'
        );

        const Transaction = (await import("@ethereumjs/tx")).Transaction;
        this.evmTx = new Transaction(txData, { 'common': common });

        // Set the EIP155 bits
        this.evmTx.raw[6] = Buffer.from([this.chainId]); // v
        this.evmTx.raw[7] = Buffer.from([]); // r
        this.evmTx.raw[8] = Buffer.from([]); // s
    }
}