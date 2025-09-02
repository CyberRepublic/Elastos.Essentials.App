import { getUserOpHash } from '@account-abstraction/utils';
import { BigNumber, ethers } from 'ethers';
import { Logger } from 'src/app/logger';
import { AccountAbstractionService } from 'src/app/wallet/services/account-abstraction/account-abstraction.service';
import { BundlerService } from 'src/app/wallet/services/account-abstraction/bundler.service';
import { AccountAbstractionTransaction } from 'src/app/wallet/services/account-abstraction/model/account-abstraction-transaction';
import { UserOperation } from 'src/app/wallet/services/account-abstraction/model/user-operation';
import {
  BaseAccount__factory,
  EntryPoint__factory,
  SimpleAccount__factory
} from 'src/app/wallet/services/account-abstraction/typechain';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import {
  AccountAbstractionProvider,
  AccountAbstractionProviderChainConfig
} from '../../../../evms/account-abstraction-provider';
import { EVMNetwork } from '../../../../evms/evm.network';
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
    bundlerRpcUrl: 'https://bundler.eadd.co/rpc',
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

    const initCode = AccountAbstractionService.instance.getAccountInitCode(
      network,
      eoaAddress,
      chainConfig.factoryAddress
    );

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

  private getAccountInitCode;

  public async bundleTransaction(
    networkWallet: AccountAbstractionNetworkWallet,
    transaction: AccountAbstractionTransaction
  ): Promise<void> {
    // Services
    const aaService = AccountAbstractionService.instance;
    const bundlerService = BundlerService.instance;

    // Inits
    const network = networkWallet.network;
    const aaAddress = networkWallet.getAccountAbstractionAddress();
    const eoaControllerNetworkWallet = await networkWallet.getControllerNetworkWallet();
    const eoaControllerAddress = eoaControllerNetworkWallet.getAddresses()[0].address;
    const chainConfig = this.getSupportedChain(network.getMainChainID());

    Logger.log('wallet', 'PG provider is starting to bundle transaction.');
    Logger.log('wallet', 'AA address:', aaAddress);
    Logger.log('wallet', 'EOA controller address:', eoaControllerAddress);

    const callData = aaService.encodeExecute(transaction.to, transaction.value, transaction.data);
    Logger.log('wallet', 'Execute-encoded call data:', callData);

    const paymasterAndData = chainConfig.paymasterAddress; // Just the address for noz (zehua)

    const provider = network.getJsonRpcProvider();

    const [initCode, nonce, gasPrice, feeData] = await Promise.all([
      aaService.getAccountInitCode(network, eoaControllerAddress, chainConfig.factoryAddress),
      aaService.getNonce(network, chainConfig.entryPointAddress, aaAddress),
      provider.getGasPrice(),
      provider.getFeeData()
    ]);

    Logger.log('wallet', 'Init code:', initCode);
    Logger.log('wallet', 'Nonce:', nonce);

    let partialUserOp: Omit<UserOperation, 'signature'> = {
      sender: aaAddress,
      nonce,
      initCode,
      callData,
      callGasLimit: '0x1',
      verificationGasLimit: '0x1',
      preVerificationGas: ethers.BigNumber.from(1).toHexString(), // uint256 as hex string
      maxFeePerGas: feeData.maxFeePerGas?.toHexString() || gasPrice.toHexString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toHexString() || gasPrice.toHexString(),
      paymasterAndData
    };

    Logger.log('wallet', 'Partial user op:', partialUserOp);

    // Estimate gas using our own method
    const gasEstimation = await this.estimateUserOpGas(network, partialUserOp);
    Logger.log('wallet', 'Gas estimation results:', gasEstimation);

    // Update partial user op with our gas estimates
    partialUserOp = {
      ...partialUserOp,
      callGasLimit: gasEstimation.callGasLimit.toHexString(),
      verificationGasLimit: gasEstimation.verificationGasLimit.toHexString(),
      preVerificationGas: gasEstimation.preVerificationGas.toHexString(),
      maxFeePerGas: gasEstimation.maxFeePerGas.toHexString(),
      maxPriorityFeePerGas: gasEstimation.maxPriorityFeePerGas.toHexString()
    };

    const userOpForHash = {
      ...partialUserOp,
      accountGasLimits: ethers.utils.hexZeroPad('0x1', 32), // bytes32
      gasFees: ethers.utils.hexZeroPad('0x1', 32), // bytes32 - dummy value
      signature: '0x', // Dummy value when getting hash
      paymasterAndData: '0x' // Dummy value when getting hash
    };

    Logger.log('wallet', 'Getting user op hash for op:', userOpForHash);

    const userOpHash = getUserOpHash(userOpForHash, chainConfig.entryPointAddress, network.getMainChainID());
    ///const userOpHash = await aaService.getUserOpHash(network, userOpForHash, chainConfig.entryPointAddress);

    Logger.log('wallet', 'User op hash:', userOpHash);

    let signature = await eoaControllerNetworkWallet.signDigest(eoaControllerAddress, userOpHash.substring(2), null);
    console.log('wallet', 'TEMP Signature:', signature);

    if (!signature) {
      throw new Error('Failed to sign user op hash');
    }

    const fullUserOp: UserOperation = { ...partialUserOp, signature };
    Logger.log('wallet', 'Sending full user op:', fullUserOp);

    const txid = await bundlerService.sendUserOpToBundler(
      fullUserOp,
      chainConfig.entryPointAddress,
      chainConfig.bundlerRpcUrl
    );
    console.log('woot, aa txid', txid);
  }

  /**
   * Estimates gas for a user operation using available services
   *
   * @param network The network to estimate gas on
   * @param partialUserOp The partial user operation to estimate gas for
   * @returns Promise resolving to gas estimation results
   */
  public async estimateUserOpGas(
    network: EVMNetwork,
    partialUserOp: Omit<UserOperation, 'signature'>
  ): Promise<{
    totalGas: BigNumber;
    callGasLimit: BigNumber;
    verificationGasLimit: BigNumber;
    preVerificationGas: BigNumber;
    estimatedCost: BigNumber;
    pgaCost: BigNumber;
    gasPrice: BigNumber;
    maxFeePerGas: BigNumber;
    maxPriorityFeePerGas: BigNumber;
    ethPerTokenRate: BigNumber;
  }> {
    try {
      Logger.log('wallet', '🔍 Starting UserOperation Gas estimation...');

      // Get services
      const chainConfig = this.getSupportedChain(network.getMainChainID());
      const provider = network.getJsonRpcProvider();

      // Get gas price and fee data
      const gasPrice = await provider.getGasPrice();
      const feeData = await provider.getFeeData();

      Logger.log('wallet', 'Current network Gas price:', gasPrice.toString());
      Logger.log('wallet', 'Fee data:', feeData);

      Logger.log('wallet', 'Partial user op for estimation:', partialUserOp);

      // Create SimpleAccount instance to get real gas estimates
      const SimpleAccount = SimpleAccount__factory.connect(partialUserOp.sender, provider);

      // Estimate gas for the execute call
      let callGasLimit: BigNumber;
      try {
        // Use the BaseAccount interface to decode the callData
        const baseAccountInterface = BaseAccount__factory.createInterface();
        const decodedCall = baseAccountInterface.decodeFunctionData('execute', partialUserOp.callData);
        const [target, value, data] = decodedCall;

        callGasLimit = await SimpleAccount.estimateGas.execute(target, value, data);
        Logger.log('wallet', 'Estimated execute gas:', callGasLimit.toString());
      } catch (error) {
        throw new Error(`Failed to estimate execute gas: ${error}`);
      }

      // Pre-verification gas is a constant in the AA SDK
      const preVerificationGas = BigNumber.from(60000);

      // For verification gas, we need to estimate validateUserOp gas
      // This is more complex as it requires a full UserOperation
      let verificationGasLimit: BigNumber;
      try {
        // Create a dummy user operation for gas estimation
        const dummyUserOp = {
          sender: partialUserOp.sender,
          nonce: partialUserOp.nonce,
          initCode: '0x',
          callData: partialUserOp.callData,
          accountGasLimits: ethers.utils.hexZeroPad('0x1', 32),
          preVerificationGas: preVerificationGas.toHexString(),
          gasFees: ethers.utils.hexZeroPad(gasPrice.toHexString(), 32),
          paymasterAndData: '0x',
          signature: '0x'
        };

        // Estimate validateUserOp gas
        verificationGasLimit = await SimpleAccount.estimateGas.validateUserOp(
          dummyUserOp,
          ethers.utils.hexZeroPad('0x1', 32), // dummy userOpHash
          BigNumber.from(0) // missingAccountFunds
        );
        Logger.log('wallet', 'Estimated validateUserOp gas:', verificationGasLimit.toString());
      } catch (error) {
        Logger.warn('wallet', 'Failed to estimate validateUserOp gas, using fallback:', error);
        verificationGasLimit = BigNumber.from(100000); // Reasonable fallback for SimpleAccount
        callGasLimit = BigNumber.from(50000); // Reasonable fallback for call gas
      }

      const estimates = {
        preVerificationGas: preVerificationGas.toHexString(),
        verificationGasLimit: verificationGasLimit.toHexString(),
        callGasLimit: callGasLimit.toHexString()
      };

      Logger.log('wallet', 'Real gas estimates from SimpleAccount:', estimates);

      // Create custom paymaster contract interface for ethPerTokenRate
      const paymasterAbi = ['function ethPerTokenRate() view returns (uint256)'];
      const paymasterContract = new ethers.Contract(chainConfig.paymasterAddress, paymasterAbi, provider);
      const ethPerTokenRate = await paymasterContract.ethPerTokenRate();
      Logger.log('wallet', '📊 Paymaster ethPerTokenRate:', ethPerTokenRate.toString());

      // Calculate total gas
      const totalGas = BigNumber.from(estimates.preVerificationGas)
        .add(estimates.verificationGasLimit)
        .add(estimates.callGasLimit);

      Logger.log('wallet', 'Total gas:', totalGas.toString());

      // Calculate estimated cost
      const estimatedCost = totalGas.mul(gasPrice);
      const pgaCost = estimatedCost.mul(ethPerTokenRate).div(10000);

      Logger.log('wallet', 'Gas estimation results:');
      Logger.log('wallet', '   Call Gas Limit:', estimates.callGasLimit);
      Logger.log('wallet', '   Verification Gas Limit:', estimates.verificationGasLimit);
      Logger.log('wallet', '   PreVerification Gas:', estimates.preVerificationGas);
      Logger.log('wallet', '   Total Gas usage:', totalGas.toString());
      Logger.log('wallet', '   Estimated cost:', ethers.utils.formatEther(estimatedCost), 'ELA');
      Logger.log('wallet', '   PGA cost:', ethers.utils.formatEther(pgaCost), 'PGA');

      return {
        totalGas,
        callGasLimit: BigNumber.from(estimates.callGasLimit),
        verificationGasLimit: BigNumber.from(estimates.verificationGasLimit),
        preVerificationGas: BigNumber.from(estimates.preVerificationGas),
        estimatedCost,
        pgaCost,
        gasPrice,
        maxFeePerGas: feeData.maxFeePerGas || gasPrice,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || gasPrice,
        ethPerTokenRate
      };
    } catch (error) {
      Logger.error('wallet', 'Gas estimation failed:', error);
      throw error;
    }
  }
}
