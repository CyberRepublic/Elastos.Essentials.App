import { getUserOpHash } from '@account-abstraction/utils';
import { BigNumber, ethers } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
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

    const callData = aaService.encodeExecute(transaction.to, transaction.value, transaction.data);
    Logger.log('wallet', 'Execute-encoded call data:', callData);

    // const paymasterAndData =
    //   chainConfig.paymasterAddress +
    //   ethers.utils.defaultAbiCoder.encode(['address'], [chainConfig.gasErc20TokenAddress]).slice(2);
    const paymasterAndData = chainConfig.paymasterAddress; // Just the address for noz (zehua)

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
      preVerificationGas: ethers.BigNumber.from(1).toHexString(), // uint256 as hex string
      // maxFeePerGas: ethers.utils.hexValue(gasPrice.mul(4)), // TMP TEST HIGHER GAS
      // maxPriorityFeePerGas: '0x1',
      maxFeePerGas: parseUnits('50', 'gwei').toHexString(),
      maxPriorityFeePerGas: parseUnits('50', 'gwei').toHexString(),
      paymasterAndData
    };

    Logger.log('wallet', 'Partial user op:', partialUserOp);

    // First estimate assuming no approve
    Logger.log('wallet', 'Estimating user op gas');
    let estimates = await bundlerService.estimateUserOpGas(
      chainConfig.bundlerRpcUrl,
      partialUserOp,
      chainConfig.entryPointAddress
    );
    Logger.log('wallet', 'First gas estimates:', estimates);

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
    Logger.log('wallet', 'ERC20 spending allowance:', allowance.toString());
    // const allowanceHex = await provider.call({ to: erc20Address, data: allowanceData });
    // const allowance = BigNumber.from(ethers.utils.defaultAbiCoder.decode(['uint256'], allowanceHex)[0]);

    // if (allowance.lt(requiredToken)) {
    //   // Get the approve method call data without calling the method
    //   const approveCallData = erc20Contract.interface.encodeFunctionData('approve', [
    //     chainConfig.paymasterAddress,
    //     requiredToken.toString()
    //   ]);

    //   // Add approve call
    //   calls = [
    //     {
    //       to: chainConfig.gasErc20TokenAddress,
    //       value: '0',
    //       data: approveCallData
    //     },
    //     ...calls
    //   ];

    //   partialUserOp.callData = aaService.encodeExecuteBatch(calls);

    //   // Re-estimate
    //   estimates = await bundlerService.estimateUserOpGas(
    //     chainConfig.bundlerRpcUrl,
    //     partialUserOp,
    //     chainConfig.entryPointAddress
    //   );
    //   Logger.log('wallet', 'Second gas estimates:', estimates);

    //   partialUserOp = { ...partialUserOp, ...estimates };

    //   totalGasLimit = BigNumber.from(estimates.preVerificationGas)
    //     .add(estimates.verificationGasLimit)
    //     .add(estimates.callGasLimit);
    //   totalCostWei = totalGasLimit.mul(BigNumber.from(partialUserOp.maxFeePerGas));

    //   // requiredToken = await calculateRequiredTokenAmount(
    //   //   provider,
    //   //   totalCostWei,
    //   //   oracleAddress,
    //   //   tokenDecimals,
    //   //   oracleDecimals
    //   // );
    //   requiredToken = 5; // TMP VALUE TO AVOID DYNAMIC CALCULATION OF ERC20 AMOUNT FOR GAS

    //   // Update approve data with new amount for the final user op.
    //   calls[0].data = erc20Contract.interface.encodeFunctionData('approve', [
    //     chainConfig.paymasterAddress,
    //     requiredToken
    //   ]);
    //   partialUserOp.callData = aaService.encodeExecuteBatch(calls);
    // }

    const userOpForHash = {
      ...partialUserOp,
      accountGasLimits: ethers.utils.hexZeroPad('0x1', 32), // bytes32
      gasFees: ethers.utils.hexZeroPad(ethers.utils.hexValue(gasPrice), 32), // bytes32
      signature: '0x', // Dummy value when getting hash
      paymasterAndData: '0x' // Dummy value when getting hash
    };

    Logger.log('wallet', 'Getting user op hash for op:', userOpForHash);

    const userOpHash = getUserOpHash(userOpForHash, chainConfig.entryPointAddress, network.getMainChainID());
    ///const userOpHash = await aaService.getUserOpHash(network, userOpForHash, chainConfig.entryPointAddress);

    Logger.log('wallet', 'User op hash:', userOpHash);

    // Confirmation screen here: display details to user

    //let password = await AuthService.instance.getWalletPassword(networkWallet.masterWallet.id, true, false); // Don't force password

    let signature = await eoaControllerNetworkWallet.signDigest(eoaControllerAddress, userOpHash.substring(2), null);
    console.log('wallet', 'TEMP Signature:', signature);

    if (!signature) {
      throw new Error('Failed to sign user op hash');
    }

    const fullUserOp: UserOperation = { ...partialUserOp, signature };
    Logger.log('wallet', 'Sending full user op:', fullUserOp);

    const requiredPrefund = this.getRequiredPrefund({
      verificationGasLimit: fullUserOp.verificationGasLimit,
      callGasLimit: fullUserOp.callGasLimit,
      paymasterVerificationGasLimit: '0', // Not provided by bundler estimates
      paymasterPostOpGasLimit: '0', // Not provided by bundler estimates
      preVerificationGas: fullUserOp.preVerificationGas,
      maxFeePerGas: fullUserOp.maxFeePerGas
    });
    Logger.log('wallet', 'Required prefund:', requiredPrefund.toString());

    const txid = await bundlerService.sendUserOpToBundler(
      fullUserOp,
      chainConfig.entryPointAddress,
      chainConfig.bundlerRpcUrl
    );
    console.log('woot, aa txid', txid);
  }

  /**
   * Simulates the Solidity _getRequiredPrefund function
   * Calculates the required prefund amount based on gas limits and max fee per gas
   *
   * @param userOp The user operation containing gas limits and fee information
   * @returns The required prefund amount as a BigNumber
   */
  public getRequiredPrefund(userOp: {
    verificationGasLimit: string | number;
    callGasLimit: string | number;
    paymasterVerificationGasLimit: string | number;
    paymasterPostOpGasLimit: string | number;
    preVerificationGas: string | number;
    maxFeePerGas: string | number;
  }): BigNumber {
    // Convert all values to BigNumber for safe arithmetic operations
    const verificationGasLimit = BigNumber.from(userOp.verificationGasLimit);
    const callGasLimit = BigNumber.from(userOp.callGasLimit);
    const paymasterVerificationGasLimit = BigNumber.from(userOp.paymasterVerificationGasLimit);
    const paymasterPostOpGasLimit = BigNumber.from(userOp.paymasterPostOpGasLimit);
    const preVerificationGas = BigNumber.from(userOp.preVerificationGas);
    const maxFeePerGas = BigNumber.from(userOp.maxFeePerGas);

    console.log('verificationGasLimit', verificationGasLimit.toString());
    console.log('callGasLimit', callGasLimit.toString());
    console.log('paymasterVerificationGasLimit', paymasterVerificationGasLimit.toString());
    console.log('paymasterPostOpGasLimit', paymasterPostOpGasLimit.toString());
    console.log('preVerificationGas', preVerificationGas.toString());
    console.log('maxFeePerGas', maxFeePerGas.toString());

    // Calculate total required gas (equivalent to Solidity's unchecked arithmetic)
    const requiredGas = verificationGasLimit
      .add(callGasLimit)
      .add(paymasterVerificationGasLimit)
      .add(paymasterPostOpGasLimit)
      .add(preVerificationGas);

    console.log('requiredGas', requiredGas.toString());
    console.log('maxFeePerGas', maxFeePerGas.toString());

    // Calculate required prefund = requiredGas * maxFeePerGas
    const requiredPrefund = requiredGas.mul(maxFeePerGas);

    return requiredPrefund;
  }
}

// async signUserOpHash (userOpHash: string): Promise<string> {
//   const privateKey = (this.owner as any).privateKey
//   const sig = ecsign(Buffer.from(arrayify(userOpHash)), Buffer.from(arrayify(privateKey)))
//   return toRpcSig(sig.v, sig.r, sig.s)
// }
