import { BigNumber, ethers } from 'ethers';
import { Logger } from 'src/app/logger';
import { AccountAbstractionService } from 'src/app/wallet/services/account-abstraction/account-abstraction.service';
import { BundlerService } from 'src/app/wallet/services/account-abstraction/bundler.service';
import { AccountAbstractionTransaction } from 'src/app/wallet/services/account-abstraction/model/account-abstraction-transaction';
import { UserOperation } from 'src/app/wallet/services/account-abstraction/model/user-operation';
import {
  EntryPoint__factory,
  ERC20__factory,
  SimpleAccountFactory__factory
} from 'src/app/wallet/services/account-abstraction/typechain';
import { EVMService } from 'src/app/wallet/services/evm/evm.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import {
  AccountAbstractionProvider,
  AccountAbstractionProviderChainConfig
} from '../../../../evms/account-abstraction-provider';
import { AccountAbstractionNetworkWallet } from '../../../../evms/networkwallets/account-abstraction.networkwallet';

/**
 * TODO:
 * yes need to provide the fee infromation to user and check erc20 token balance,
 * but fee is calucluated by entrypoint, and bundler account will pay and
 *  paymster will send ela to bundler.
 */

type PGAAChainConfig = AccountAbstractionProviderChainConfig & {
  gasErc20TokenAddress: string;
  gasErc20TokenDecimals: number;
};

const PG_AA_CHAIN_CONFIGS: PGAAChainConfig[] = [
  {
    chainId: 12343,
    entryPointAddress: '0x8308DF3bb308A669942220614032098BbE62E11A',
    bundlerRpcUrl: 'https://bundler-test.eadd.co/rpc',
    paymasterAddress: '0x0348E7c415cE40188f3e2AFf5d2f936d28D791cb',
    factoryAddress: '0x3fDA83ab9564eC18Cb413f4bdf83e2789DD7D173',
    gasErc20TokenAddress: '0x0348E7c415cE40188f3e2AFf5d2f936d28D791cb', // Test PGA - same as paymaster...
    gasErc20TokenDecimals: 18 // Test PGA
  }
];

/**
 * PG AA Account Provider for ECO chain
 * Implements Account Abstraction functionality specific to the PG implementation
 */
export class PGAccountAbstractionProvider extends AccountAbstractionProvider<PGAAChainConfig> {
  constructor() {
    super('pg', 'PG ECO Chain Account', PG_AA_CHAIN_CONFIGS);
  }

  /**
   * Get the AA account address for a given EOA account on a specific chain by asking the contract itself.
   *
   * @param eoaAddress The EOA address
   * @param chainId The chain ID
   * @returns Promise resolving to the AA account address
   */
  async getAccountAddress(eoaAddress: string, chainId: number): Promise<string> {
    Logger.log('wallet', `PGAAAccountProvider: Getting AA account address for EOA ${eoaAddress} on chain ${chainId}`);

    // Check if chain is supported
    if (!this.supportsChain(chainId)) {
      return Promise.reject(new Error(`Chain ${chainId} is not supported by PG AA Account Provider`));
    }

    // Get the chain configuration
    const chainConfig = this.supportedChains.find(chain => chain.chainId === chainId);

    if (!chainConfig) {
      throw new Error(`Chain configuration not found for chain ${chainId}`);
    }

    // Retrieve network for given chain id.
    const network = WalletNetworkService.instance.getNetworkByChainId(chainId);
    if (!network) {
      throw new Error(`Network not found for chain ${chainId}`);
    }

    // Create provider and signer
    const originalProvider = network.getJsonRpcProvider();

    const entryPoint = EntryPoint__factory.connect(chainConfig.entryPointAddress, originalProvider);

    const factory = SimpleAccountFactory__factory.connect(chainConfig.factoryAddress, originalProvider);

    // Generate proper initCode: factory address + encoded function data
    const encodedFunctionData = factory.interface.encodeFunctionData('createAccount', [
      eoaAddress,
      0 // salt
    ]);

    // initCode should be: factory address (20 bytes) + encoded function data
    const factoryAddressHex = chainConfig.factoryAddress.slice(2); // Remove 0x prefix
    const initCode = '0x' + factoryAddressHex + encodedFunctionData.slice(2);

    let senderAddress: string;
    try {
      await entryPoint.callStatic.getSenderAddress(initCode);
      Logger.error(
        'wallet',
        `PGAAAccountProvider: senderAddress success from direct call, abnormal, it should always revert!`
      );
    } catch (e: any) {
      if (e.errorArgs && e.errorArgs.sender) {
        senderAddress = e.errorArgs.sender;
      } else {
        Logger.log('wallet', `PGAAAccountProvider: No sender in error args, full error:`, e);
        throw e;
      }
    }

    return senderAddress;
  }

  public async bundleTransaction(
    networkWallet: AccountAbstractionNetworkWallet,
    transaction: AccountAbstractionTransaction
  ): Promise<void> {
    // Services
    const aaService = AccountAbstractionService.instance;
    const bundlerService = BundlerService.instance;
    const evmService = EVMService.instance;

    // Inits
    const network = networkWallet.network;
    const aaAddress = networkWallet.getAccountAbstractionAddress();
    const eoaControllerNetworkWallet = await networkWallet.getControllerNetworkWallet();
    const eoaControllerAddress = eoaControllerNetworkWallet.getAddresses()[0].address;
    const provider = network.getJsonRpcProvider();
    const chainConfig = this.getSupportedChain(network.getMainChainID());
    const erc20Contract = ERC20__factory.connect(chainConfig.gasErc20TokenAddress, provider);

    Logger.log('wallet', 'PG provider is starting to bundle transaction.');
    Logger.log('wallet', 'AA address:', aaAddress);
    Logger.log('wallet', 'EOA controller address:', eoaControllerAddress);

    let calls: AccountAbstractionTransaction[] = [transaction];

    Logger.log('wallet', 'Batch encoding calls:', calls);
    const callData = aaService.encodeExecuteBatch(calls);
    Logger.log('wallet', 'Batch encoded calls:', callData);

    const paymasterAndData =
      chainConfig.paymasterAddress +
      ethers.utils.defaultAbiCoder.encode(['address'], [chainConfig.gasErc20TokenAddress]).slice(2);

    const initCode = await aaService.getInitCode(network, aaAddress, eoaControllerAddress, chainConfig.factoryAddress);
    Logger.log('wallet', 'Init code:', initCode);

    const nonce = await aaService.getNonce(network, chainConfig.entryPointAddress, aaAddress);
    Logger.log('wallet', 'Nonce:', nonce);

    const gasPrice = await provider.getGasPrice();
    Logger.log('wallet', 'Gas price:', gasPrice);

    let partialUserOp: Omit<UserOperation, 'signature'> = {
      sender: aaAddress,
      nonce,
      initCode,
      callData,
      callGasLimit: '0x1',
      verificationGasLimit: '0x1',
      preVerificationGas: '0x1',
      maxFeePerGas: ethers.utils.hexValue(gasPrice),
      maxPriorityFeePerGas: '0x1',
      paymasterAndData
    };

    // First estimate assuming no approve
    let estimates = await bundlerService.estimateUserOpGas(
      chainConfig.bundlerRpcUrl,
      partialUserOp,
      chainConfig.entryPointAddress
    );

    partialUserOp = { ...partialUserOp, ...estimates };

    let totalGasLimit = BigNumber.from(estimates.preVerificationGas)
      .add(estimates.verificationGasLimit)
      .add(estimates.callGasLimit);
    let totalCostWei = totalGasLimit.mul(BigNumber.from(partialUserOp.maxFeePerGas));

    // let requiredToken = await calculateRequiredTokenAmount(
    //   provider,
    //   totalCostWei,
    //   oracleAddress,
    //   tokenDecimals,
    //   oracleDecimals
    // );

    let requiredToken = 4; // TMP VALUE TO AVOID DYNAMIC CALCULATION OF ERC20 AMOUNT FOR GAS
    const allowance = await erc20Contract.allowance(aaAddress, chainConfig.paymasterAddress);
    // const allowanceHex = await provider.call({ to: erc20Address, data: allowanceData });
    // const allowance = BigNumber.from(ethers.utils.defaultAbiCoder.decode(['uint256'], allowanceHex)[0]);

    if (allowance.lt(requiredToken)) {
      const approveMethod = await erc20Contract.approve(chainConfig.paymasterAddress, requiredToken.toString());

      // const { gasLimit, nonce } = await EVMService.instance.methodGasAndNonce(approveMethod, network, sender, "0");

      // Add approve call
      calls = [
        {
          to: chainConfig.gasErc20TokenAddress,
          value: '0',
          data: approveMethod.data
        },
        ...calls
      ];

      partialUserOp.callData = aaService.encodeExecuteBatch(calls);

      // Re-estimate
      estimates = await bundlerService.estimateUserOpGas(
        chainConfig.bundlerRpcUrl,
        partialUserOp,
        chainConfig.entryPointAddress
      );

      partialUserOp = { ...partialUserOp, ...estimates };

      totalGasLimit = BigNumber.from(estimates.preVerificationGas)
        .add(estimates.verificationGasLimit)
        .add(estimates.callGasLimit);
      totalCostWei = totalGasLimit.mul(BigNumber.from(partialUserOp.maxFeePerGas));

      // requiredToken = await calculateRequiredTokenAmount(
      //   provider,
      //   totalCostWei,
      //   oracleAddress,
      //   tokenDecimals,
      //   oracleDecimals
      // );
      requiredToken = 5; // TMP VALUE TO AVOID DYNAMIC CALCULATION OF ERC20 AMOUNT FOR GAS

      // Update approve data with new amount for the final user op.
      calls[0].data = erc20Contract.interface.encodeFunctionData('approve', [
        chainConfig.paymasterAddress,
        requiredToken
      ]);
      partialUserOp.callData = aaService.encodeExecuteBatch(calls);
    }

    const userOpHash = await aaService.getUserOpHash(
      network,
      {
        sender: aaAddress,
        nonce,
        initCode,
        callData,
        accountGasLimits: '0x1',
        preVerificationGas: '0x1',
        gasFees: ethers.utils.hexValue(gasPrice)
      },
      chainConfig.entryPointAddress
    );

    // Confirmation screen here: display details to user

    const signature = 'TODO REAL SIGNATURE'; // await aaService.signUserOp(userOpHash, privateKey, provider);

    const fullUserOp: UserOperation = { ...partialUserOp, signature };

    const txid = await bundlerService.sendUserOpToBundler(
      fullUserOp,
      chainConfig.entryPointAddress,
      chainConfig.bundlerRpcUrl
    );
    console.log('woot, aa txid', txid);
  }
}
