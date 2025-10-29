import { CoinID, StandardCoinName } from "../../../../../coin";
import { AnyNetworkWallet } from "../../../../base/networkwallets/networkwallet";
import { ERC20SubWallet } from "../../../../evms/subwallets/erc20.subwallet";
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { Logger } from "src/app/logger";
import { Config } from "src/app/wallet/config/Config";
import { Util } from "src/app/model/util";
import { EVMSafe } from "../../../../evms/safes/evm.safe";
import BigNumber from 'bignumber.js';
import { ElastosPGPNetworkBase } from "../network/pgp.networks";

/**
 * Subwallet for Eco-ERC20 tokens.
 */
export class PGPERC20SubWallet extends ERC20SubWallet {
  private withdrawContract: any;
  private withdrawContractAddress: string;

  // Centralized mapping for ECO ERC20 token contract addresses to icon assets
  private static readonly TOKEN_ICON_MAP: Record<string, string> = {
    '0x0000000000000000000000000000000000000065': 'assets/wallet/networks/elastos-eco.svg',
    '0x45ec25a63e010bfb84629242f40dda187f83833e': 'assets/wallet/coins/btcd.png',
    '0x67d8183f13043be52f64fb434f1aa5e5d1c58775': 'assets/wallet/coins/fist.png',
    '0x8152557dd7d8dbfa2e85eae473f8b897a5b6cca9': 'assets/wallet/coins/pga.png',
    '0x1c4e7cd89ea67339d4a5ed2780703180a19757d7': 'assets/wallet/coins/usdt.svg'
  };

  constructor(networkWallet: AnyNetworkWallet, coinID: CoinID) {
    super(networkWallet, coinID, "PGP-ERC20 token");

    this.spvConfigEVMCode = StandardCoinName.ETHECOPGP;
    this.withdrawContractAddress = Config.ETHECOPGP_WITHDRAW_ADDRESS.toLowerCase();
    this.tokenAmountMulipleTimes = new BigNumber(10).pow(this.tokenDecimals)
  }

  public getMainIcon(): string {
    const contract = this.coin.getContractAddress();
    const addr = contract ? contract.toLowerCase() : '';
    return PGPERC20SubWallet.TOKEN_ICON_MAP[addr] ?? 'assets/wallet/coins/pga.png';
  }

  public getSecondaryIcon(): string {
    return null;
  }

  public getDisplayableERC20TokenInfo(): string {
    return "";
  }

  public supportInternalTransactions() {
    return false;
  }

  private isELAToken() {
    let elaTokenAddress = (this.networkWallet.network as ElastosPGPNetworkBase).getELATokenContract();
    if (this.coin.getContractAddress() === elaTokenAddress) return true;

    return false;
  }

  public supportsCrossChainTransfers(): boolean {
    if (this.isELAToken()) {
      // Only wallets imported with mnemonic have cross chain capability because we then have both mainchain
      // and sidechains addresses.
      return this.networkWallet.masterWallet.hasMnemonicSupport()
    }
    else return false;
  }

  public getCrossChainFee(): number {
    if (this.isELAToken()) {
      // The minimum gas price set for eco sidechain is 50, The gas limit for cross chain transactions is approximately 21512,
      // so the fee set in the SDK is 150000.
      return 150000;
    }
    else return -1;
  }

  protected async getWithdrawContract() {
    if (!this.withdrawContract) {
      const contractAbi = [{
        "inputs": [
          {
            "internalType": "string",
            "name": "_addr",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "_amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_fee",
            "type": "uint256"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }];
      const highPriorityWeb3 = await this.createWeb3(true);
      this.withdrawContract = new (highPriorityWeb3.eth.Contract)(contractAbi, this.withdrawContractAddress);
    }
    return await this.withdrawContract;
  }

  public async estimateWithdrawTransactionGas(toAddress: string) {
    const ethscWithdrawContract = await this.getWithdrawContract()
    const method = ethscWithdrawContract.methods.withdraw(toAddress, '100000', Config.PGP_WITHDRAW_GASPRICE);

    let estimateGas = 3000000;
    try {
      // Can not use method.estimateGas(), must set the "value"
      let tx = {
        data: method.encodeABI(),
        to: this.withdrawContractAddress,
        value: '100000',
      }
      const highPriorityWeb3 = await this.createWeb3(true);
      let tempGasLimit = await highPriorityWeb3.eth.estimateGas(tx);
      // Make sure the gaslimit is big enough - add a bit of margin for fluctuating gas price
      estimateGas = Util.ceil(tempGasLimit * 1.5, 100);

    } catch (error) {
        Logger.error('wallet', 'pgp estimateWithdrawTransactionGas error:', error);
    }

    return estimateGas;
  }

  public async createWithdrawTransaction(toAddress: string, toAmount: number, memo: string, gasPriceArg: string, gasLimitArg: string, nonceArg = -1): Promise<string> {
    const withdrawContract = await this.getWithdrawContract()
    let gasPrice = gasPriceArg;
    if (gasPrice === null) {
      gasPrice = await this.getGasPrice();
    }

    let gasLimit = gasLimitArg;
    if (gasLimit === null) {
      let estimateGas = await this.estimateWithdrawTransactionGas(toAddress);
      gasLimit = estimateGas.toString();
    }

    let amountWithDecimals: BigNumber;
    if (toAmount === -1) { //-1: send all.
        amountWithDecimals = this.balance;
    } else {
        amountWithDecimals = new BigNumber(toAmount).multipliedBy(this.tokenAmountMulipleTimes);
    }

    const method = withdrawContract.methods.withdraw(toAddress, amountWithDecimals, Config.PGP_WITHDRAW_GASPRICE);

    let nonce = nonceArg;
    if (nonce === -1) {
      nonce = await EVMService.instance.getNonce(this.networkWallet.network, this.networkWallet.getAddresses()[0].address);
    }
    Logger.log('wallet', 'pgp createWithdrawTransaction gasPrice:', gasPrice.toString(), ' toAmountSend:', amountWithDecimals.toString(), ' nonce:', nonce, ' withdrawContractAddress:', this.withdrawContractAddress);

    return (this.networkWallet.safe as unknown as EVMSafe).createContractTransaction(this.withdrawContractAddress, '0', gasPrice, gasLimit, nonce, method.encodeABI());
  }
}