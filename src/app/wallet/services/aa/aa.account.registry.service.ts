import { Injectable } from "@angular/core";
import { Logger } from "src/app/logger";

export interface AAImplementation {
  name: string;
  description: string;
  factoryAddress: string;
  implementationAddress: string;
  entryPointAddress: string;
  supportedChains: number[];
  isVerified: boolean;
  website?: string;
  documentation?: string;
}

export interface AAChainConfig {
  chainId: number;
  chainName: string;
  entryPointAddress: string;
  supportedImplementations: string[]; // factory addresses
}

@Injectable({
  providedIn: "root",
})
export class AAAccountRegistryService {
  private static instance: AAAccountRegistryService = null;

  // Popular AA implementations
  private aaImplementations: AAImplementation[] = [
    {
      name: "Safe Account",
      description:
        "Multi-signature smart contract wallet with advanced security features",
      factoryAddress: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
      implementationAddress: "0x3E5c63644E683549055b9Be6653c6d1bC2eC8C9C",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedChains: [1, 137, 10, 42161, 56, 43114, 250, 100, 1101, 8453],
      isVerified: true,
      website: "https://safe.global",
      documentation: "https://docs.safe.global",
    },
    {
      name: "Biconomy Account",
      description: "Gasless transactions and social recovery features",
      factoryAddress: "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      implementationAddress: "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      entryPointAddress: "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      supportedChains: [1, 137, 10, 42161, 56, 43114, 250, 100, 1101, 8453],
      isVerified: true,
      website: "https://biconomy.io",
      documentation: "https://docs.biconomy.io",
    },
    {
      name: "Argent Account",
      description: "Social recovery and daily spending limits",
      factoryAddress: "0x0000000000000000000000000000000000000000", // Placeholder
      implementationAddress: "0x0000000000000000000000000000000000000000", // Placeholder
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedChains: [1, 137, 10, 42161],
      isVerified: true,
      website: "https://argent.xyz",
      documentation: "https://docs.argent.xyz",
    },
    {
      name: "Zerodev Account",
      description: "Modular account with plugin system",
      factoryAddress: "0x0000000000000000000000000000000000000000", // Placeholder
      implementationAddress: "0x0000000000000000000000000000000000000000", // Placeholder
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedChains: [1, 137, 10, 42161, 56, 43114, 250, 100, 1101, 8453],
      isVerified: true,
      website: "https://zerodev.app",
      documentation: "https://docs.zerodev.app",
    },
  ];

  // Chain configurations
  private chainConfigs: AAChainConfig[] = [
    {
      chainId: 1,
      chainName: "Ethereum Mainnet",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 137,
      chainName: "Polygon",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 10,
      chainName: "Optimism",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 42161,
      chainName: "Arbitrum One",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 56,
      chainName: "BNB Smart Chain",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 43114,
      chainName: "Avalanche C-Chain",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 250,
      chainName: "Fantom",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 100,
      chainName: "Gnosis Chain",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 1101,
      chainName: "Polygon zkEVM",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
    {
      chainId: 8453,
      chainName: "Base",
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      supportedImplementations: [
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        "0x000000F9ee1842Bb72F6BBDD75e6D3d4b3a1D953",
      ],
    },
  ];

  constructor() {
    AAAccountRegistryService.instance = this;
  }

  public static getInstance(): AAAccountRegistryService {
    return AAAccountRegistryService.instance;
  }

  /**
   * Get all available AA implementations
   */
  public getAvailableImplementations(): AAImplementation[] {
    return [...this.aaImplementations];
  }

  /**
   * Get AA implementations supported on a specific chain
   */
  public getImplementationsForChain(chainId: number): AAImplementation[] {
    return this.aaImplementations.filter((impl) =>
      impl.supportedChains.includes(chainId)
    );
  }

  /**
   * Get chain configuration for a specific chain
   */
  public getChainConfig(chainId: number): AAChainConfig | null {
    return (
      this.chainConfigs.find((config) => config.chainId === chainId) || null
    );
  }

  /**
   * Get all supported chains
   */
  public getSupportedChains(): AAChainConfig[] {
    return [...this.chainConfigs];
  }

  /**
   * Get implementation by factory address
   */
  public getImplementationByFactory(
    factoryAddress: string
  ): AAImplementation | null {
    return (
      this.aaImplementations.find(
        (impl) =>
          impl.factoryAddress.toLowerCase() === factoryAddress.toLowerCase()
      ) || null
    );
  }

  /**
   * Add a custom AA implementation
   */
  public addCustomImplementation(implementation: AAImplementation): void {
    // Validate the implementation
    if (!implementation.name || !implementation.factoryAddress) {
      throw new Error("Invalid AA implementation: missing required fields");
    }

    // Check if already exists
    const existing = this.aaImplementations.find(
      (impl) =>
        impl.factoryAddress.toLowerCase() ===
        implementation.factoryAddress.toLowerCase()
    );

    if (existing) {
      Logger.warn(
        "wallet",
        "AA implementation already exists:",
        implementation.name
      );
      return;
    }

    this.aaImplementations.push(implementation);
    Logger.log(
      "wallet",
      "Added custom AA implementation:",
      implementation.name
    );
  }

  /**
   * Remove a custom AA implementation
   */
  public removeCustomImplementation(factoryAddress: string): boolean {
    const index = this.aaImplementations.findIndex(
      (impl) =>
        impl.factoryAddress.toLowerCase() === factoryAddress.toLowerCase()
    );

    if (index !== -1) {
      const removed = this.aaImplementations.splice(index, 1)[0];
      Logger.log("wallet", "Removed AA implementation:", removed.name);
      return true;
    }

    return false;
  }

  /**
   * Get recommended implementation for a chain
   */
  public getRecommendedImplementation(
    chainId: number
  ): AAImplementation | null {
    const implementations = this.getImplementationsForChain(chainId);

    // Prefer verified implementations
    const verified = implementations.filter((impl) => impl.isVerified);
    if (verified.length > 0) {
      // Prefer Safe Account as it's most widely used
      const safe = verified.find((impl) => impl.name === "Safe Account");
      if (safe) return safe;

      return verified[0];
    }

    return implementations[0] || null;
  }
}
