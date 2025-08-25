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

  // PG AA Account implementation
  private aaImplementations: AAImplementation[] = [
    {
      name: "PG AA Account",
      description: "Account Abstraction wallet implementation",
      factoryAddress: "0x0000000000000000000000000000000000000000", // TODO: Set actual factory address
      implementationAddress: "0x0000000000000000000000000000000000000000", // TODO: Set actual implementation address
      entryPointAddress: "0x0000000000000000000000000000000000000000", // TODO: Set actual entry point address
      supportedChains: [12343], // Only ECO chain
      isVerified: false, // TODO: Verify when contracts are deployed
      website: undefined, // TODO: Add website when available
      documentation: undefined, // TODO: Add documentation when available
    },
  ];

  // Chain configuration for ECO chain only
  private chainConfigs: AAChainConfig[] = [
    {
      chainId: 12343,
      chainName: "Elastos ECO Chain",
      entryPointAddress: "0x0000000000000000000000000000000000000000", // TODO: Set actual entry point address
      supportedImplementations: [
        "0x0000000000000000000000000000000000000000", // TODO: Set actual factory address
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
