/*
 * Copyright (c) 2020 Elastos Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Injectable } from "@angular/core";
import { PrivateKeyType } from "../model/masterwallets/wallet.types";
import { LocalStorage } from "./storage.service";

export type StandardWalletSafe = {
  seed?: string;
  mnemonic?: string;
  privateKey?: string;
  privateKeyType?: PrivateKeyType;
};

export type AASafe = {
  deployedAddresses: { [networkKey: string]: string }; // Network key -> deployed address mapping
  implementationAddresses: { [networkKey: string]: string }; // Network key -> implementation address mapping
  deploymentTxHashes: { [networkKey: string]: string }; // Network key -> deployment tx hash mapping
  deploymentTimestamps: { [networkKey: string]: number }; // Network key -> deployment timestamp mapping
};

/**
 * Service used to store sensitive wallet information such as seeds.
 * We use a dedicated memory-only object here to avoid storing (even encrypted) seeds and secret wallet keys
 * in wallet objects, as those object tend to be logged often. Secret wallet information should not be
 * output to logs.
 */
@Injectable({ providedIn: "root" })
export class SafeService {
  public static instance: SafeService = null;

  private standardWalletSafes: { [walletId: string]: StandardWalletSafe } = {};
  private aaSafes: { [walletId: string]: AASafe } = {};

  constructor(private localStorage: LocalStorage) {
    SafeService.instance = this;
  }

  /**
   * Gets a safe entry that is initialized with empty content if not yet existing.
   * This entry can be edited directly.
   */
  public getStandardWalletSafe(walletId: string): StandardWalletSafe {
    let safe = this.standardWalletSafes[walletId];
    if (!safe) {
      safe = {};
      this.standardWalletSafes[walletId] = safe;
    }

    return safe;
  }

  public getAASafe(walletId: string): AASafe {
    let safe = this.aaSafes[walletId];
    if (!safe) {
      safe = {
        deployedAddresses: {},
        implementationAddresses: {},
        deploymentTxHashes: {},
        deploymentTimestamps: {},
      };
      this.aaSafes[walletId] = safe;
    }
    return safe;
  }

  /**
   * Save AA safe data to persistent storage
   */
  public async saveAASafe(walletId: string): Promise<void> {
    const safe = this.aaSafes[walletId];
    if (safe) {
      await this.localStorage.saveAASafe(walletId, safe);
    }
  }

  /**
   * Load AA safe data from persistent storage
   */
  public async loadAASafe(walletId: string): Promise<void> {
    const safe = await this.localStorage.loadAASafe(walletId);
    if (safe) {
      this.aaSafes[walletId] = safe;
    }
  }

  /**
   * Update deployed address for a specific network
   */
  public async updateAADeployedAddress(
    walletId: string,
    networkKey: string,
    deployedAddress: string,
    implementationAddress?: string,
    deploymentTxHash?: string
  ): Promise<void> {
    const safe = this.getAASafe(walletId);
    safe.deployedAddresses[networkKey] = deployedAddress;
    if (implementationAddress) {
      safe.implementationAddresses[networkKey] = implementationAddress;
    }
    if (deploymentTxHash) {
      safe.deploymentTxHashes[networkKey] = deploymentTxHash;
    }
    safe.deploymentTimestamps[networkKey] = Date.now();

    // Persist to disk
    await this.saveAASafe(walletId);
  }

  /**
   * Get deployed address for a specific network
   */
  public getAADeployedAddress(
    walletId: string,
    networkKey: string
  ): string | null {
    const safe = this.aaSafes[walletId];
    return safe?.deployedAddresses[networkKey] || null;
  }

  /**
   * Check if AA wallet is deployed on a specific network
   */
  public isAAWalletDeployed(walletId: string, networkKey: string): boolean {
    const safe = this.aaSafes[walletId];
    return !!safe?.deployedAddresses[networkKey];
  }
}
