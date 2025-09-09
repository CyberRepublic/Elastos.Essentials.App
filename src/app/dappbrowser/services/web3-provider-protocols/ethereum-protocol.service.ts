import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import moment from 'moment';
import { Subscription } from 'rxjs';
import { unsafeRandomHex } from 'src/app/helpers/random.helper';
import { Logger } from 'src/app/logger';
import { AddEthereumChainParameter, SwitchEthereumChainParameter } from 'src/app/model/ethereum/requestparams';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalSwitchNetworkService } from 'src/app/services/global.switchnetwork.service';
import type { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { EVMNetwork } from 'src/app/wallet/model/networks/evms/evm.network';
import { AnyEVMNetworkWallet } from 'src/app/wallet/model/networks/evms/networkwallets/evm.networkwallet';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import type { EthSignIntentResult } from 'src/app/wallet/pages/intents/ethsign/intentresult';
import type { PersonalSignIntentResult } from 'src/app/wallet/pages/intents/personalsign/intentresult';
import type { SignTypedDataIntentResult } from 'src/app/wallet/pages/intents/signtypeddata/intentresult';
import type { EditCustomNetworkIntentResult } from 'src/app/wallet/pages/settings/edit-custom-network/intentresult';
import {
  BrowserConnectionType,
  BrowserWalletConnectionsService
} from 'src/app/wallet/services/browser-wallet-connections.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { DABMessage, DappBrowserService } from '../dappbrowser.service';

declare let dappBrowser: DappBrowserPlugin.DappBrowser;

type WalletPermissionCaveat = {
  type: string;
  value: any;
};

type WalletPermission = {
  caveats: WalletPermissionCaveat[];
  date: number; // The date the permission was granted, in UNIX epoch time
  id?: string;
  invoker: string; //`http://${string}` | `https://${string}`
  parentCapability: 'eth_accounts' | string;
};

@Injectable({
  providedIn: 'root'
})
export class EthereumProtocolService {
  private userEVMAddress: string = null;
  private activeChainID: number;
  private activeEVMNetworkRpcUrl: string = null;
  private web3ProviderCode: string = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private browserWalletConnectionsService: BrowserWalletConnectionsService,
    private httpClient: HttpClient
  ) {}

  /**
   * Initialize the service by loading the Web3 provider code
   */
  async initialize(): Promise<void> {
    Logger.log('ethereum', 'Loading the IAB web3 provider');
    this.web3ProviderCode = await this.httpClient
      .get('assets/essentialsiabweb3provider.js', { responseType: 'text' })
      .toPromise();
  }

  /**
   * Handles Ethereum/EVM-specific messages from the dApp
   */
  async handleMessage(message: DABMessage): Promise<void> {
    if (!this.isEthereumMessage(message.data.name)) {
      Logger.warn('ethereum', 'Received non-ethereum message', message.data.name);
      return;
    }

    Logger.log('ethereum', 'Handling Ethereum command:', message.data.name);

    switch (message.data.name) {
      // WEB3 PROVIDER
      case 'eth_sendTransaction':
        dappBrowser.hide();
        await this.handleSendTransaction(message);
        this.showBrowser();
        break;
      case 'eth_requestAccounts':
        // NOTE: for now, directly return user accounts without asking for permission
        await this.handleRequestAccounts(message);
        break;
      case 'eth_signTypedData':
        dappBrowser.hide();
        await this.handleSignTypedData(message);
        this.showBrowser();
        break;
      case 'personal_sign':
        dappBrowser.hide();
        await this.handlePersonalSign(message);
        this.showBrowser();
        break;
      case 'signInsecureMessage':
        dappBrowser.hide();
        await this.handleInsecureEthSign(message);
        void dappBrowser.show();
        break;
      case 'wallet_switchEthereumChain':
        Logger.log('ethereum', 'Received switch ethereum chain request');
        dappBrowser.hide();
        await this.handleSwitchEthereumChain(message);
        this.showBrowser();
        break;
      case 'wallet_addEthereumChain':
        Logger.log('ethereum', 'Received add ethereum chain request');
        dappBrowser.hide();
        await this.handleAddEthereumChain(message);
        this.showBrowser();
        break;
      case 'wallet_requestPermissions':
        Logger.log('ethereum', 'Received permissions request');
        dappBrowser.hide();
        await this.handleRequestPermissions(message);
        this.showBrowser();
        break;
      default:
        Logger.warn('ethereum', 'Unhandled ethereum message command', message.data.name);
    }
  }

  /**
   * Gets the JavaScript code to inject the Ethereum provider into the webpage
   */
  getProviderInjectionCode(walletAddress: string, chainId: number, rpcUrl: string): string {
    this.userEVMAddress = walletAddress;
    this.activeChainID = chainId;
    this.activeEVMNetworkRpcUrl = rpcUrl;

    if (!this.web3ProviderCode) {
      Logger.warn('ethereum', 'Web3 provider code not loaded');
      return '';
    }

    return (
      this.web3ProviderCode +
      `
        console.log('Essentials Web3 provider is being created');
        window.ethereum = new DappBrowserWeb3Provider(${chainId}, '${rpcUrl}', '${walletAddress}');
        window.web3 = {
            currentProvider: window.ethereum
        };
        console.log('Essentials Web3 provider is injected', window.ethereum, window.web3);
      `
    );
  }

  /**
   * Gets the injection code for a specific URL, handling wallet connections and address extraction
   */
  async getInjectionCodeForUrl(url: string): Promise<string> {
    if (!url) {
      Logger.warn('ethereum', 'No URL provided for injection code generation');
      return this.getProviderInjectionCode('', -1, '');
    }

    // Check for existing EVM wallet connection for this dapp
    const evmWallet = await this.browserWalletConnectionsService.getConnectedWallet(url, BrowserConnectionType.EVM);
    const selectedNetwork = await this.browserWalletConnectionsService.getSelectedEVMNetwork(url);

    // Get address from connected wallet
    let evmAddress: string | undefined = undefined;
    let chainId: number | undefined = undefined;
    let rpcUrl = '';

    if (evmWallet) {
      const evmSubwallet = evmWallet.getMainEvmSubWallet();
      if (evmSubwallet) {
        evmAddress = await evmSubwallet.getCurrentReceiverAddress();
      }
    }

    if (selectedNetwork && selectedNetwork.getMainChainID && selectedNetwork.getRPCUrl) {
      chainId = selectedNetwork.getMainChainID();
      rpcUrl = selectedNetwork.getRPCUrl();
    }

    return this.getProviderInjectionCode(evmAddress, chainId, rpcUrl);
  }

  /**
   * Sets up subscriptions to EVM wallet and network changes for the current dApp
   */
  setupSubscriptions(): void {
    // Subscribe to EVM wallet changes for the current dApp
    const evmWalletSub = this.browserWalletConnectionsService.activeDappEVMWallet.subscribe(evmWallet => {
      if (evmWallet) {
        Logger.log('ethereum', 'EVM wallet changed for active dApp:', evmWallet.masterWallet.name);
        // Handle async operations without blocking the subscribe callback
        void this.updateEVMWalletAddress(evmWallet)
          .then(() => {
            void this.sendActiveWalletToDApp(evmWallet);
          })
          .catch(error => {
            Logger.error('ethereum', 'Error updating EVM wallet address:', error);
          });
      } else {
        Logger.log('ethereum', 'EVM wallet disconnected for active dApp');
        this.userEVMAddress = null;
        // Notify the web3 provider about the disconnection
        void this.sendActiveWalletToDApp(undefined);
      }
    });

    // Subscribe to EVM network changes for the current dApp
    const evmNetworkSub = this.browserWalletConnectionsService.activeDappEVMNetwork.subscribe(network => {
      if (network) {
        Logger.log('ethereum', 'EVM network changed for active dApp:', network.name);
        void this.sendActiveNetworkToDApp(network);
      }
    });

    this.subscriptions.push(evmWalletSub, evmNetworkSub);
  }

  /**
   * Updates the injected provider with a newly connected wallet
   */
  async updateProviderWithWallet(dappUrl: string, walletAddress: string): Promise<void> {
    if (!walletAddress) return;

    try {
      const updateScript = `
        if (window.ethereum && window.ethereum.setAddress) {
          window.ethereum.setAddress('${walletAddress}');
        }
      `;

      await this.executeScript(updateScript);
      Logger.log('ethereum', 'Updated ethereum provider with address:', walletAddress);
    } catch (error) {
      Logger.error('ethereum', 'Error updating ethereum provider:', error);
    }
  }

  /**
   * Updates the network information for the current dApp
   */
  sendActiveNetworkToDApp(activeNetwork: AnyNetwork): void {
    // Get the active network RPC URL
    if (activeNetwork instanceof EVMNetwork) {
      this.activeEVMNetworkRpcUrl = activeNetwork.getRPCUrl();
      // Get the active network chain ID
      this.activeChainID = activeNetwork.getMainChainID();
    } else {
      this.activeEVMNetworkRpcUrl = null;
      this.activeChainID = -1;
    }

    Logger.log(
      'ethereum',
      'Sending active network to dapp',
      activeNetwork.key,
      this.activeChainID,
      this.activeEVMNetworkRpcUrl
    );

    // Network updates are coordinated through the main service
    void this.executeScript(`
      window.ethereum.setRPCApiEndpoint(${this.activeChainID}, '${this.activeEVMNetworkRpcUrl}');
      window.ethereum.setChainId(${this.activeChainID});
    `);
  }

  /**
   * Updates the wallet address for the current dApp
   */
  async sendActiveWalletToDApp(networkWallet: AnyNetworkWallet | undefined): Promise<void> {
    // Get the active wallet address
    if (networkWallet) {
      const evmSubwallet = networkWallet.getMainEvmSubWallet();
      if (evmSubwallet) {
        this.userEVMAddress = await evmSubwallet.getCurrentReceiverAddress();
      } else {
        this.userEVMAddress = null;
      }

      Logger.log('ethereum', 'Sending active address to dapp', this.userEVMAddress);

      // Network updates are coordinated through the main service
      void this.executeScript(`
        window.ethereum.setAddress('${this.userEVMAddress}');
      `);
    } else {
      Logger.log('ethereum', 'Sending wallet disconnection to dapp');

      // When disconnecting, both address and chain must become udnefined
      void this.executeScript(`
        if (window.ethereum && window.ethereum.setAddress) {
          window.ethereum.setAddress(undefined);
          window.ethereum.setChainId(undefined);
        }
      `);
    }
  }

  /**
   * Cleanup subscriptions
   */
  public removeSubscriptions(): void {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.subscriptions = [];
  }

  // Private message handlers

  private isEthereumMessage(messageName: string): boolean {
    return (
      messageName.startsWith('eth_') ||
      messageName.startsWith('wallet_') ||
      messageName === 'personal_sign' ||
      messageName === 'signInsecureMessage'
    );
  }

  /**
   * Executes a smart contract transaction then returns the result to the calling dApp.
   */
  private async handleSendTransaction(message: DABMessage): Promise<void> {
    const response: {
      action: string;
      result: {
        txid: string;
        status: 'published' | 'cancelled';
      };
    } = await GlobalIntentService.instance.sendIntent('https://wallet.web3essentials.io/esctransaction', {
      payload: {
        params: [message.data.object]
      }
    });

    // 32 Bytes - the transaction hash, or the zero hash if the transaction is not yet available.
    if (response.result.txid) {
      this.sendInjectedResponse('ethereum', message.data.id, response.result.txid);
    } else {
      let errorMessage = 'Transaction rejected.';
      let code = 32003;
      if (response.result.status === 'cancelled') {
        errorMessage = 'User rejected the request.';
        code = 4001;
      }
      this.sendInjectedError('ethereum', message.data.id, {
        code: code,
        message: errorMessage
      });
    }
  }

  /**
   * Returns the active user address to the calling dApp.
   * If no wallet is connected, triggers wallet selection.
   */
  private async handleRequestAccounts(message: DABMessage): Promise<void> {
    const currentUrl = this.getCurrentUrl();
    if (!currentUrl) {
      Logger.warn('ethereum', 'No current URL available for request accounts');
      this.sendInjectedError('ethereum', message.data.id, {
        code: 4001,
        message: 'User rejected the request.'
      });
      return;
    }

    // Check if we already have a connected wallet for this dapp
    let evmWallet = await this.browserWalletConnectionsService.getConnectedWallet(
      currentUrl,
      BrowserConnectionType.EVM
    );

    if (!evmWallet) {
      Logger.log('ethereum', 'No connected EVM wallet found, triggering wallet selection');

      // Hide the browser and prompt for wallet selection
      dappBrowser.hide();

      try {
        // Ask user to pick a EVM wallet.
        const connectedMasterWallet = await this.browserWalletConnectionsService.connectWallet(
          currentUrl,
          BrowserConnectionType.EVM
        );

        // Get the network wallet from the master wallet.
        const connectedNetwork = this.browserWalletConnectionsService.activeDappEVMNetwork.value;
        evmWallet = (await connectedNetwork.createNetworkWallet(connectedMasterWallet, false)) as AnyEVMNetworkWallet;

        if (evmWallet) {
          // Update the injected provider with the new wallet
          const evmSubwallet = evmWallet.getMainEvmSubWallet();
          if (evmSubwallet) {
            const address = await evmSubwallet.getCurrentReceiverAddress();
            await this.updateProviderWithWallet(currentUrl, address);
          }
          Logger.log('ethereum', 'Successfully connected EVM wallet for dapp:', currentUrl);
        } else {
          Logger.log('ethereum', 'Wallet selection cancelled');
          this.sendInjectedError('ethereum', message.data.id, {
            code: 4001,
            message: 'User rejected the request.'
          });
          this.showBrowser();
          return;
        }
      } catch (error) {
        Logger.error('ethereum', 'Error during wallet selection:', error);
        this.sendInjectedError('ethereum', message.data.id, {
          code: -32603,
          message: 'Internal error'
        });
        this.showBrowser();
        return;
      }

      // Show the browser again
      this.showBrowser();
    }

    // Return the connected wallet address
    if (evmWallet) {
      const evmSubwallet = evmWallet.getMainEvmSubWallet();
      if (evmSubwallet) {
        const address = await evmSubwallet.getCurrentReceiverAddress();
        this.sendInjectedResponse('ethereum', message.data.id, [address]);
      } else {
        this.sendInjectedError('ethereum', message.data.id, {
          code: -32603,
          message: 'Unable to get EVM address'
        });
      }
    } else {
      this.sendInjectedError('ethereum', message.data.id, {
        code: 4001,
        message: 'User rejected the request.'
      });
    }
  }

  /**
   * Sign data with wallet private key according to EIP 712.
   */
  private async handleSignTypedData(message: DABMessage): Promise<void> {
    const rawData: { payload: string; useV4: boolean } = message.data.object;
    const response: { result: SignTypedDataIntentResult } = await GlobalIntentService.instance.sendIntent(
      'https://wallet.web3essentials.io/signtypeddata',
      rawData
    );
    this.sendInjectedResponse('ethereum', message.data.id, response.result.signedData);
  }

  /**
   * Sign data with wallet private key according to EIP 712.
   */
  private async handlePersonalSign(message: DABMessage): Promise<void> {
    const rawData: { data: unknown } = message.data.object;
    const response: { result: PersonalSignIntentResult } = await GlobalIntentService.instance.sendIntent(
      'https://wallet.web3essentials.io/personalsign',
      rawData
    );
    this.sendInjectedResponse('ethereum', message.data.id, response.result.signedData);
  }

  /**
   * Sign data with wallet private key according. Legacy insecure eth_sign command support.
   */
  private async handleInsecureEthSign(message: DABMessage): Promise<void> {
    const rawData: { data: unknown } = message.data.object;
    const response: { result: EthSignIntentResult } = await GlobalIntentService.instance.sendIntent(
      'https://wallet.web3essentials.io/insecureethsign',
      rawData
    );
    this.sendInjectedResponse('ethereum', message.data.id, response.result.signedData);
  }

  private async handleSwitchEthereumChain(message: DABMessage): Promise<void> {
    const switchParams: SwitchEthereumChainParameter = message.data.object;

    const chainId = parseInt(switchParams.chainId);

    const targetNetwork = WalletNetworkService.instance.getNetworkByChainId(chainId);
    if (!targetNetwork) {
      // We don't support this network
      this.sendInjectedError('ethereum', message.data.id, {
        code: 4902,
        message: 'Unsupported network'
      });
      return;
    } else {
      // Do nothing if already on the right network
      if ((WalletNetworkService.instance.activeNetwork.value as EVMNetwork).getMainChainID() === chainId) {
        Logger.log('ethereum', 'Already on the right network');
        this.sendInjectedResponse('ethereum', message.data.id, {}); // Successfully switched
        return;
      }

      const networkSwitched = await GlobalSwitchNetworkService.instance.promptSwitchToNetwork(targetNetwork);
      if (networkSwitched) {
        Logger.log('ethereum', 'Successfully switched to the new network');
        this.sendInjectedResponse('ethereum', message.data.id, {}); // Successfully switched
      } else {
        Logger.log('ethereum', 'Network switch cancelled');
        this.sendInjectedError('ethereum', message.data.id, {
          code: -1,
          message: 'Cancelled operation'
        });
      }
    }
  }

  private async handleAddEthereumChain(message: DABMessage): Promise<void> {
    // Check if this network already exists or not.
    const addParams: AddEthereumChainParameter = message.data.object;
    const chainId = parseInt(addParams.chainId);

    let networkWasAdded = false;
    let addedNetworkKey: string;
    const existingNetwork = WalletNetworkService.instance.getNetworkByChainId(chainId);
    if (!existingNetwork) {
      // Network doesn't exist yet. Send an intent to the wallet and wait for the response.
      const response: EditCustomNetworkIntentResult = await GlobalIntentService.instance.sendIntent(
        'https://wallet.web3essentials.io/addethereumchain',
        addParams
      );

      if (response && response.networkAdded) {
        networkWasAdded = true;
        addedNetworkKey = response.networkKey;
      }
    }

    // Not on this network, ask user to switch
    if ((WalletNetworkService.instance.activeNetwork.value as EVMNetwork).getMainChainID() !== chainId) {
      let targetNetwork = existingNetwork;
      if (!targetNetwork) targetNetwork = WalletNetworkService.instance.getNetworkByKey(addedNetworkKey) as EVMNetwork;

      if (targetNetwork) {
        // Ask user to switch but we don't mind the result.
        await GlobalSwitchNetworkService.instance.promptSwitchToNetwork(targetNetwork);
      }
    }

    if (networkWasAdded || existingNetwork) {
      // Network added, or network already existed => success, no matter if user chosed to switch or not
      this.sendInjectedResponse('ethereum', message.data.id, {}); // Successfully added or existing
    } else {
      this.sendInjectedError('ethereum', message.data.id, {
        code: 4001,
        message: 'User rejected the request.'
      });
    }
  }

  /**
   * TODO: Add screen to let user confirm
   */
  private handleRequestPermissions(message: DABMessage): Promise<void> {
    const walletPermissions: WalletPermission = {
      id: unsafeRandomHex(21),
      parentCapability: 'eth_accounts',
      invoker: this.getCurrentUrl(),
      caveats: [
        {
          type: 'restrictReturnedAccounts',
          value: [this.userEVMAddress]
        }
      ],
      date: moment().valueOf() // ms
    };
    this.sendInjectedResponse('ethereum', message.data.id, [walletPermissions]);
    return;
  }

  // Helper methods

  /**
   * Gets the current URL from the dappbrowser service
   */
  private getCurrentUrl(): string {
    return DappBrowserService.instance.url;
  }

  // Provider injection coordination with main service handled elsewhere

  /**
   * Updates the EVM wallet address for the current dApp
   */
  private async updateEVMWalletAddress(evmWallet: AnyNetworkWallet): Promise<void> {
    try {
      const evmSubwallet = evmWallet.getMainEvmSubWallet();
      if (evmSubwallet) {
        this.userEVMAddress = await evmSubwallet.getCurrentReceiverAddress();
        Logger.log('ethereum', 'Updated EVM address:', this.userEVMAddress);
      }
    } catch (error) {
      Logger.error('ethereum', 'Error updating EVM wallet address:', error);
      this.userEVMAddress = null;
    }
  }

  /**
   * Sends a successful response to the injected provider
   */
  private sendInjectedResponse(provider: string, id: number, result: any): void {
    const stringifiedResult = JSON.stringify(result);
    const code = `window.${provider}.sendResponse(${id}, ${stringifiedResult})`;
    Logger.log('ethereum', `Sending ${provider} response:`, stringifiedResult);
    void dappBrowser.executeScript({ code });
  }

  /**
   * Sends an error response to the injected provider
   */
  private sendInjectedError(provider: string, id: number, error: string | { code: number; message: string }): void {
    const stringifiedError = JSON.stringify(error);
    const code = `window.${provider}.sendError(${id}, ${stringifiedError})`;
    Logger.log('ethereum', `Sending ${provider} error:`, stringifiedError);
    void dappBrowser.executeScript({ code });
  }

  /**
   * Executes JavaScript code in the browser context
   */
  private executeScript(code: string): Promise<void> {
    return dappBrowser.executeScript({ code });
  }

  /**
   * Show the browser view
   */
  private showBrowser(): void {
    void dappBrowser.show();
  }
}
