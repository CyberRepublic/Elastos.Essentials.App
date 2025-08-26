export type AccountAbstractionProviderChainConfig = {
  chainId: number;
  entryPointAddress: string;
  bundlerRpcUrl: string;
  paymasterAddress: string;
  factoryAddress: string;
};

export abstract class AccountAbstractionProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedChains: AccountAbstractionProviderChainConfig[];

  constructor(
    id: string,
    name: string,
    supportedChains: AccountAbstractionProviderChainConfig[]
  ) {
    this.id = id;
    this.name = name;
    this.supportedChains = supportedChains;
  }

  /**
   * Returns the expected AA account address for a given EOA owner on a specific chain.
   * This works only for AA providers that support EOA ownership.
   */
  abstract getAccountAddress(
    eoaAddress: string,
    chainId: number
  ): Promise<string>;

  /**
   * Check if this provider supports a specific chain
   * @param chainId The chain ID
   * @returns True if supported
   */
  supportsChain(chainId: number): boolean {
    return this.supportedChains.some(
      (chainConfig) => chainConfig.chainId === chainId
    );
  }
}
