import {Injectable} from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Logger } from '../logger';
import { GlobalDIDSessionsService, IdentityEntry } from './global.didsessions.service';
import { GlobalNetworksService } from './global.networks.service';
import { GlobalPreferencesService } from './global.preferences.service';
import { GlobalService, GlobalServiceManager } from './global.service.manager';

export enum ElastosApiUrlType {
    // Main chain
    ELA_RPC = "mainChainRPC",
    // DID 1.0 deprecated chain
    DID_RPC = "idChainRPC",
    // ESC chain
    ETHSC_RPC = "escRPC",
    ETHSC_MISC = "escMiscRPC",
    ETHSC_ORACLE = "escOracleRPC",
    ETHSC_BROWSER = "escBrowserRPC",
    // DID 2.0 EID chain
    EID_RPC = "eidChainRPC",
    EID_MISC = "eidMiscRPC",
    // Cyber republic
    CR_RPC = "crRPC"
}

export type ElastosAPIProvider = {
    key: string; // Unique identifier
    name: string; // User friendly name
    description: string; // User friendly description

    // Each supported network template has its own list of endpoints
    endpoints: {
        [networkTemplate: string]: {
            // ELA mainchain
            mainChainRPC: string;
            // DID 1.0 deprecated ID chain
            idChainRPC: string;
            // DID 2.0 ID chain (EVM)
            eidChainRPC: string;
            eidMiscRPC: string;
            eidOracleRPC: string;
            // Elastos Smart Contract (ESC) chain
            escRPC: string;
            escOracleRPC: string;
            escMiscRPC: string;
            escBrowserRPC: string;
            // Cyber Republic
            crRPC: string;
        }
    }
};

/**
 * Service reponsible for switching between different API providers for elastos features,
 * such as Elastos ESCRPC, CyberRepublic listings, etc.
 *
 * Ex: elastos.io VS trinity-tech.cn
 */
@Injectable({
    providedIn: 'root'
})
export class GlobalElastosAPIService extends GlobalService {
    private availableProviders: ElastosAPIProvider[] = [];

    /** RxJS subject that holds the currently active api provider */
    public activeProvider: BehaviorSubject<ElastosAPIProvider> = null;

    constructor(private prefs: GlobalPreferencesService, private globalNetworksService: GlobalNetworksService) {
        super();

        // TODO: Move to root config/ folder
        this.availableProviders = [
            {
                key: "elastosio",
                name: "elastos.io",
                description: "Set of Elastos APIs deployed and maintained by the Elastos Foundation's Elastos Fusion sub-team, also known as the product team.",
                endpoints: {
                    "MainNet": {
                        mainChainRPC: 'https://api.elastos.io/ela',
                        idChainRPC: 'https://api.elastos.io/did',
                        eidChainRPC: 'https://api.elastos.io/eid',
                        eidMiscRPC: '',
                        eidOracleRPC: '',
                        escRPC: 'https://api.elastos.io/eth',
                        escMiscRPC: 'https://api.elastos.io/misc',
                        escOracleRPC: 'https://api.elastos.io/oracle',
                        escBrowserRPC: 'https://eth.elastos.io',
                        crRPC: 'https://api.cyberrepublic.org'
                    },
                    "TestNet": {
                        // TODO - testnet endpoints
                        mainChainRPC: 'https://api.elastos.io/ela',
                        idChainRPC: 'https://api.elastos.io/did',
                        eidChainRPC: 'https://api.elastos.io/eid',
                        eidMiscRPC: '',
                        eidOracleRPC: '',
                        escRPC: 'https://api.elastos.io/eth',
                        escOracleRPC: 'https://api.elastos.io/oracle',
                        escMiscRPC: 'https://api.elastos.io/misc',
                        escBrowserRPC: 'https://eth.elastos.io',
                        crRPC: 'https://api.cyberrepublic.org'
                    }
                }
            },
            {
                key: "ttechcn",
                name: "trinity-tech.cn",
                description: "Set of Elastos APIs deployed and maintained by the Elastos Foundation's Trinity Tech team, responsible for Elastos SDKs development.",
                endpoints: {
                    "MainNet": {
                        mainChainRPC: 'https://api.trinity-tech.cn/ela',
                        idChainRPC: 'https://api.trinity-tech.cn/did',
                        eidChainRPC: 'https://api.trinity-tech.cn/eid',
                        eidMiscRPC: 'https://api.trinity-tech.cn/eid-misc',
                        eidOracleRPC: 'https://api.trinity-tech.cn/eid-oracle',
                        escRPC: 'https://api.trinity-tech.cn/eth',
                        escOracleRPC: 'https://api.trinity-tech.cn/eth-oracle',
                        escMiscRPC: 'https://api.trinity-tech.cn/eth-misc',
                        escBrowserRPC: '',
                        crRPC: 'https://api.cyberrepublic.org'
                    },
                    "TestNet": {
                        mainChainRPC: 'https://api-testnet.trinity-tech.cn/ela',
                        idChainRPC: 'https://api-testnet.trinity-tech.cn/did',
                        eidChainRPC: 'https://api-testnet.trinity-tech.cn/eid',
                        eidMiscRPC: 'https://aapi-testnetpi.trinity-tech.cn/eid-misc',
                        eidOracleRPC: 'https://api-testnet.trinity-tech.cn/eid-oracle',
                        escRPC: 'https://api-testnet.trinity-tech.cn/eth',
                        escOracleRPC: 'https://api-testnet.trinity-tech.cn/eth-oracle',
                        escMiscRPC: 'https://api-testnet.trinity-tech.cn/eth-misc',
                        escBrowserRPC: '',
                        crRPC: 'https://api.cyberrepublic.org'
                    }
                }
            }
        ];
    }

    /**
     * Initializes the service, including reloading the saved provider.
     */
    public init(): Promise<void> {
        GlobalServiceManager.getInstance().registerService(this);
        return;
    }

    async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
        // Retrieve user's preferred provider from preferences
        let providerName = await this.prefs.getPreference(signedInIdentity.didString, "elastosapi.provider") as string;
        let provider = this.getProviderByName(providerName);
        if (!provider) {
            // This provider doesn't exist any more maybe. Use the default provider.
            this.activeProvider = new BehaviorSubject(this.getDefaultProvider());
        }
        else {
            this.activeProvider = new BehaviorSubject(provider);
        }

        Logger.log("elastosapi", "User's Elastos API provider is:", this.activeProvider.value);
    }

    onUserSignOut(): Promise<void> {
        return;
    }

    private getProviderByName(providerName: string): ElastosAPIProvider {
        return this.availableProviders.find(p => p.name === providerName);
    }

    private getDefaultProvider(): ElastosAPIProvider {
        return this.availableProviders[0];
    }

    public getAvailableProviders(): ElastosAPIProvider[] {
        return this.availableProviders;
    }

    /**
     * Starts using the given api provider for all elastos operations.
     * This provider is persisted in preferences and reused upon Essentials restart.
     */
    public async useProvider(provider: ElastosAPIProvider): Promise<void> {
        Logger.log("elastosapi", "Setting provider to " + provider.key);
        await this.prefs.setPreference(GlobalDIDSessionsService.signedInDIDString, "elastosapi.provider", provider.name);
        this.activeProvider.next(provider);
    }

    public getActiveProvider(): ElastosAPIProvider {
        return this.activeProvider.value;
    }

    /**
     * Returns the right API endpoint for the given URL service type (esc rpc, eid misc, etc) and based
     * on the currenly active network template and elastos API provider.
     *
     * Ex: "MainNet" network template + "elastos.io" provider + "ETHSC_RPC" api type ==> https://api.elastos.io/eth
     */
    public getApiUrl(type: ElastosApiUrlType): string {
        let apiUrl = null;

        let activeProvider = this.activeProvider.value;
        let activeNetworkTemplate = this.globalNetworksService.activeNetworkTemplate.value;

        // Make sure the currently active network template is supported by our elastos api providers
        if (!(activeNetworkTemplate in activeProvider.endpoints)) {
            Logger.warn("elastosapi", "Unknown network template "+activeNetworkTemplate+"!");
            return null;
        }

        // Make sure the currently activ eprovider supports the requested API url type
        let endpoints = activeProvider.endpoints[activeNetworkTemplate];
        if (!(type in endpoints)) {
            Logger.warn("elastosapi", "Elastos API provider "+activeProvider.name+" does not support url type "+type+"!");
            return null;
        }

        return endpoints[type];
      }
}
