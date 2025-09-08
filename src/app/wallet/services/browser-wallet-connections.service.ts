/**
 * This service manages connections made by dapps in the built in browser to wallet accounts.
 * In the past, this was done automatically by using the active master wallet as wallet in the browser.
 * Nevertheless, this is no longer the case as we need t omaintain different wallet connections for different
 * dapps, and handle the bitcoin wallet separately from the EVM wallet (a different wallet mnemonic
 * rather often).
 *
 * NOTE: for now this is not related to how wallet connect works. This is only for injected connections.
 * Though this could support wallet connect in the future ideally.
 */

import { Injectable } from '@angular/core';
import { Logger } from 'src/app/logger';
import { AnyNetworkWallet } from '../model/networks/base/networkwallets/networkwallet';
import { AnyNetwork } from '../model/networks/network';
import { WalletNetworkService } from './network.service';
import { WalletNetworkUIService } from './network.ui.service';
import { LocalStorage } from './storage.service';
import { WalletService } from './wallet.service';
import { WalletUIService } from './wallet.ui.service';

/**
 * Type of connection to the browser. For now we only have injected providers
 * for EVM and BTC. We could support ELA too but not implemented yet.
 */
enum ConnectionType {
  EVM,
  BTC
}

/**
 * Represents a wallet connection for a specific dapp and connection type
 */
interface DappWalletConnection {
  masterWalletId: string; // ID of the connected master wallet
  networkKey?: string; // Network key for this connection (optional, uses wallet default if not set)
  connectedAt: number; // Timestamp when connection was established
}

/**
 * Network selection for a specific dapp
 */
interface DappNetworkSelection {
  networkKey: string; // Selected network key
  selectedAt: number; // Timestamp when network was selected
}

/**
 * Storage structure for all dapp connections
 * Key format: "domain:port" (e.g., "app.uniswap.org:443")
 */
interface DappConnectionsStorage {
  [dappDomain: string]: {
    evm?: DappWalletConnection;
    btc?: DappWalletConnection;
    network?: DappNetworkSelection;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BrowserWalletConnectionsService {
  public static instance: BrowserWalletConnectionsService = null;
  private readonly STORAGE_KEY = 'browser-wallet-connections';

  constructor(
    private storage: LocalStorage,
    private walletUIService: WalletUIService,
    private walletNetworkUIService: WalletNetworkUIService,
    private walletService: WalletService,
    private networkService: WalletNetworkService
  ) {
    BrowserWalletConnectionsService.instance = this;
  }

  /**
   * Extracts the domain from a URL for sandboxing connections
   * @param url The full URL of the dapp
   * @returns Domain in format "domain:port"
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
      return `${urlObj.hostname}:${port}`;
    } catch (error) {
      Logger.warn('wallet', 'Invalid URL provided to extractDomain:', url, error);
      return url; // Fallback to original string
    }
  }

  /**
   * Loads all dapp connections from storage
   */
  private async loadConnections(): Promise<DappConnectionsStorage> {
    const connections = await this.storage.get(this.STORAGE_KEY);
    return connections || {};
  }

  /**
   * Saves all dapp connections to storage
   */
  private async saveConnections(connections: DappConnectionsStorage): Promise<void> {
    await this.storage.set(this.STORAGE_KEY, JSON.stringify(connections));
  }

  /**
   * Gets the connected wallet for a specific dapp and connection type
   * @param dappUrl The URL of the dapp
   * @param connectionType The type of connection (EVM or BTC)
   * @returns The connected network wallet or null if not connected
   */
  public async getConnectedWallet(dappUrl: string, connectionType: ConnectionType): Promise<AnyNetworkWallet | null> {
    const domain = this.extractDomain(dappUrl);
    const connections = await this.loadConnections();

    const dappConnections = connections[domain];
    if (!dappConnections) {
      return null;
    }

    const connectionKey = connectionType === ConnectionType.EVM ? 'evm' : 'btc';
    const connection = dappConnections[connectionKey];

    if (!connection) {
      return null;
    }

    // Get the network wallet for this master wallet
    const networkWallet = this.walletService.getNetworkWalletFromMasterWalletId(connection.masterWalletId);
    if (!networkWallet) {
      Logger.warn('wallet', 'Connected wallet not found for masterWalletId:', connection.masterWalletId);
      return null;
    }

    return networkWallet;
  }

  /**
   * Gets the selected network for a specific dapp
   * @param dappUrl The URL of the dapp
   * @returns The selected network or null if not set
   */
  public async getSelectedNetwork(dappUrl: string): Promise<AnyNetwork | null> {
    const domain = this.extractDomain(dappUrl);
    const connections = await this.loadConnections();

    const dappConnections = connections[domain];
    if (!dappConnections?.network) {
      return null;
    }

    return this.networkService.getNetworkByKey(dappConnections.network.networkKey);
  }

  /**
   * Connects a wallet for a specific dapp and connection type
   * @param dappUrl The URL of the dapp
   * @param connectionType The type of connection (EVM or BTC)
   * @param masterWalletId Optional specific wallet ID to connect (if not provided, user will be prompted to select)
   * @returns The connected network wallet or null if cancelled
   */
  public async connectWallet(
    dappUrl: string,
    connectionType: ConnectionType,
    masterWalletId?: string
  ): Promise<AnyNetworkWallet | null> {
    const domain = this.extractDomain(dappUrl);
    Logger.log(
      'wallet',
      `Connecting ${connectionType === ConnectionType.EVM ? 'EVM' : 'BTC'} wallet for dapp:`,
      domain
    );

    let selectedWallet: AnyNetworkWallet;

    if (masterWalletId) {
      // Use provided wallet ID
      selectedWallet = this.walletService.getNetworkWalletFromMasterWalletId(masterWalletId);
      if (!selectedWallet) {
        Logger.warn('wallet', 'Provided masterWalletId not found:', masterWalletId);
        return null;
      }
    } else {
      // Let user pick a wallet
      const filter =
        connectionType === ConnectionType.EVM
          ? (wallet: AnyNetworkWallet) => wallet.network.key.startsWith('evm') || wallet.network.key.startsWith('eth')
          : (wallet: AnyNetworkWallet) => wallet.network.key.startsWith('btc');

      selectedWallet = await this.walletUIService.pickWallet(filter);
      if (!selectedWallet) {
        Logger.log('wallet', 'Wallet selection cancelled for dapp:', domain);
        return null;
      }
    }

    // Save the connection
    const connections = await this.loadConnections();
    if (!connections[domain]) {
      connections[domain] = {};
    }

    const connectionKey = connectionType === ConnectionType.EVM ? 'evm' : 'btc';
    connections[domain][connectionKey] = {
      masterWalletId: selectedWallet.masterWallet.id,
      connectedAt: Date.now()
    };

    await this.saveConnections(connections);

    Logger.log(
      'wallet',
      `Connected ${connectionType === ConnectionType.EVM ? 'EVM' : 'BTC'} wallet for dapp:`,
      domain,
      selectedWallet.masterWallet.name
    );
    return selectedWallet;
  }

  /**
   * Disconnects a wallet for a specific dapp and connection type
   * @param dappUrl The URL of the dapp
   * @param connectionType The type of connection (EVM or BTC)
   */
  public async disconnectWallet(dappUrl: string, connectionType: ConnectionType): Promise<void> {
    const domain = this.extractDomain(dappUrl);
    Logger.log(
      'wallet',
      `Disconnecting ${connectionType === ConnectionType.EVM ? 'EVM' : 'BTC'} wallet for dapp:`,
      domain
    );

    const connections = await this.loadConnections();

    if (connections[domain]) {
      const connectionKey = connectionType === ConnectionType.EVM ? 'evm' : 'btc';
      delete connections[domain][connectionKey];

      // Clean up empty domain entries
      if (Object.keys(connections[domain]).length === 0) {
        delete connections[domain];
      }

      await this.saveConnections(connections);
    }

    Logger.log(
      'wallet',
      `Disconnected ${connectionType === ConnectionType.EVM ? 'EVM' : 'BTC'} wallet for dapp:`,
      domain
    );
  }

  /**
   * Selects a network for a specific dapp
   * @param dappUrl The URL of the dapp
   * @param networkKey Optional specific network key (if not provided, user will be prompted to select)
   * @returns The selected network or null if cancelled
   */
  public async selectNetwork(dappUrl: string, networkKey?: string): Promise<AnyNetwork | null> {
    const domain = this.extractDomain(dappUrl);
    Logger.log('wallet', 'Selecting network for dapp:', domain);

    let selectedNetwork: AnyNetwork;

    if (networkKey) {
      // Use provided network key
      selectedNetwork = this.networkService.getNetworkByKey(networkKey);
      if (!selectedNetwork) {
        Logger.warn('wallet', 'Provided networkKey not found:', networkKey);
        return null;
      }
    } else {
      // Let user pick a network
      selectedNetwork = await this.walletNetworkUIService.pickNetwork();
      if (!selectedNetwork) {
        Logger.log('wallet', 'Network selection cancelled for dapp:', domain);
        return null;
      }
    }

    // Save the network selection
    const connections = await this.loadConnections();
    if (!connections[domain]) {
      connections[domain] = {};
    }

    connections[domain].network = {
      networkKey: selectedNetwork.key,
      selectedAt: Date.now()
    };

    await this.saveConnections(connections);

    Logger.log('wallet', 'Selected network for dapp:', domain, selectedNetwork.name);
    return selectedNetwork;
  }

  /**
   * Gets all connections for a specific dapp
   * @param dappUrl The URL of the dapp
   * @returns Object containing EVM, BTC, and network connections
   */
  public async getDappConnections(dappUrl: string): Promise<{
    evm: DappWalletConnection | null;
    btc: DappWalletConnection | null;
    network: DappNetworkSelection | null;
  }> {
    const domain = this.extractDomain(dappUrl);
    const connections = await this.loadConnections();

    const dappConnections = connections[domain] || {};

    return {
      evm: dappConnections.evm || null,
      btc: dappConnections.btc || null,
      network: dappConnections.network || null
    };
  }

  /**
   * Gets all dapp domains that have connections
   * @returns Array of domain strings
   */
  public async getConnectedDapps(): Promise<string[]> {
    const connections = await this.loadConnections();
    return Object.keys(connections);
  }

  /**
   * Checks if a dapp has any connections
   * @param dappUrl The URL of the dapp
   * @returns True if the dapp has connections
   */
  public async hasConnections(dappUrl: string): Promise<boolean> {
    const connections = await this.getDappConnections(dappUrl);
    return !!(connections.evm || connections.btc || connections.network);
  }

  /**
   * Clears all connections for a specific dapp
   * @param dappUrl The URL of the dapp
   */
  public async clearDappConnections(dappUrl: string): Promise<void> {
    const domain = this.extractDomain(dappUrl);
    Logger.log('wallet', 'Clearing all connections for dapp:', domain);

    const connections = await this.loadConnections();
    delete connections[domain];
    await this.saveConnections(connections);

    Logger.log('wallet', 'Cleared all connections for dapp:', domain);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getConnectedWallet instead
   */
  public connect(dapp: string, account: string) {
    Logger.warn('wallet', 'BrowserWalletConnectionsService.connect() is deprecated. Use connectWallet() instead.');
    // This method doesn't match the new API, so we'll just log a warning
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use disconnectWallet instead
   */
  public disconnect(dapp: string, account: string) {
    Logger.warn(
      'wallet',
      'BrowserWalletConnectionsService.disconnect() is deprecated. Use disconnectWallet() instead.'
    );
    // This method doesn't match the new API, so we'll just log a warning
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getDappConnections instead
   */
  public getConnections() {
    Logger.warn(
      'wallet',
      'BrowserWalletConnectionsService.getConnections() is deprecated. Use getDappConnections() instead.'
    );
    return {};
  }
}
