import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';
import { BehaviorSubject, Subscription } from 'rxjs';
import { lazyElastosHiveSDKImport } from '../helpers/import.helper';
import { Logger } from '../logger';
import { IdentityEntry } from '../model/didsessions/identityentry';
import { CRCouncilSearchResponse } from '../model/voting/cyber-republic/CRCouncilSearchResult';
import { CRProposalStatus } from '../model/voting/cyber-republic/CRProposalStatus';
import { CRProposalsSearchResponse } from '../model/voting/cyber-republic/CRProposalsSearchResponse';
import { CRMemberInfo } from '../voting/crcouncilvoting/services/crcouncil.service';
import { ProposalDetails } from '../voting/crproposalvoting/model/proposal-details';
import { StandardCoinName } from '../wallet/model/coin';
import { BPoSNFTInfo, ProducersSearchResponse, StakeInfo } from '../wallet/model/elastos.types';
import { ERCTokenInfo, EthTokenTransaction } from '../wallet/model/networks/evms/evm.types';
import { ElastosPaginatedTransactions, TransactionDetail, UtxoType } from '../wallet/model/tx-providers/transaction.types';
import { GlobalJsonRPCService } from './global.jsonrpc.service';
import { GlobalLanguageService } from './global.language.service';
import { GlobalNetworksService } from './global.networks.service';
import { GlobalPreferencesService } from './global.preferences.service';
import { GlobalService, GlobalServiceManager } from './global.service.manager';
import { DIDSessionsStore } from './stores/didsessions.store';
import { NetworkTemplateStore } from './stores/networktemplate.store';

declare let didManager: DIDPlugin.DIDManager;

export enum ElastosApiUrlType {
    // Main chain
    ELA_RPC = "mainChainRPC",
    // ESC chain
    ETHSC_RPC = "escRPC",
    ETHSC_ORACLE = "escOracleRPC",
    ETHSC_BROWSER = "escBrowserRPC",
    // DID 2.0 EID chain
    EID_RPC = "eidChainRPC",
    EID_BROWSER = "eidBrowserRPC",
    // Cyber republic
    CR_RPC = "crRPC",
    // Block Explorer
    ELA_BLOCK_EXPLORER = 'elaBlockExplorer',
    ESC_BLOCK_EXPLORER = 'escBlockExplorer',
    EID_BLOCK_EXPLORER = 'eidBlockExplorer',
    // widget
    WIDGETS = 'widgets',
    IMAGES = 'images',
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
            // idChainRPC: string;
            // DID 2.0 ID chain (EVM)
            eidChainRPC: string;
            eidBrowserRPC: string;
            eidOracleRPC: string;
            // Elastos Smart Contract (ESC) chain
            escRPC: string;
            escOracleRPC: string;
            escBrowserRPC: string;
            // Cyber Republic
            crRPC: string;
            // Block Explorer
            elaBlockExplorer: string;
            escBlockExplorer: string;
            eidBlockExplorer: string;
            // Widgets
            widgets: string;
            images: string; // nodes or CRC avatar
        }
    }
};

export enum NodeType {
    DPoS = 'v1',
    BPoS = 'v2',
    ALL = 'all'
}

export type RequestCache = {
    timestamp: number,
    result: any
}


export type ImageInfo = {
        nickname: string;
        logo: string;
};

export type ImageInfos = {
    [key: string]: ImageInfo // ownerpublickkey (BPoS node) or did (CRC)
};

/**
 * Service reponsible for switching between different API providers for elastos features,
 * such as Elastos ESCRPC, CyberRepublic listings, etc.
 */
@Injectable({
    providedIn: 'root'
})
export class GlobalElastosAPIService extends GlobalService {
    public static API_RETRY_TIMES = 3;
    public static instance: GlobalElastosAPIService = null;

    private availableProviders: ElastosAPIProvider[] = [];

    /** RxJS subject that holds the currently active api provider */
    public activeProvider: BehaviorSubject<ElastosAPIProvider> = new BehaviorSubject(null);

    private languageSubscription: Subscription = null;

    private blockHeightCache = 0;
    private blockHeightTimestamp = 0;

    private nodesCache: RequestCache[] = [];
    private crMembersCache: RequestCache = {timestamp: 0, result: null};
    private crCandidatesCache: RequestCache = {timestamp: 0, result: null};
    private crRelatedStageCache: RequestCache = {timestamp: 0, result: null};
    private crSecretaryGeneralCache: RequestCache = {timestamp: 0, result: null};

    private imagesCache: ImageInfos = null;

    constructor(
        public translate: TranslateService,
        private language: GlobalLanguageService,
        private prefs: GlobalPreferencesService,
        private globalNetworksService: GlobalNetworksService,
        private globalJsonRPCService: GlobalJsonRPCService) {
        super();
        GlobalElastosAPIService.instance = this;
    }

    /**
     * Initializes the service, including reloading the saved provider.
     */
    public init(): Promise<void> {
        GlobalServiceManager.getInstance().registerService(this);
        // DIDSession also need providers list.
        this.initProvidersList();
        this.setupDIDResolver();
        return;
    }

    private initProvidersList() {
        // TODO: Move to root config/ folder
        this.availableProviders = [
            {
                key: "elastosio",
                name: "elastos.io",
                description: '', //this.translate.instant('settings.elastos-io-des'),
                endpoints: {
                    "MainNet": {
                        mainChainRPC: 'https://api.elastos.io/ela',
                        // idChainRPC: 'https://api.elastos.io/did',
                        eidChainRPC: 'https://api.elastos.io/eid',
                        eidBrowserRPC: 'https://eid.elastos.io/api',
                        eidOracleRPC: 'https://api.elastos.io/eid-oracle',
                        escRPC: 'https://api.elastos.io/esc',
                        escOracleRPC: 'https://api.elastos.io/esc-oracle',
                        escBrowserRPC: 'https://esc.elastos.io/api',
                        crRPC: 'https://api.cyberrepublic.org',
                        elaBlockExplorer: 'https://blockchain.elastos.io',
                        escBlockExplorer: 'https://esc.elastos.io',
                        eidBlockExplorer: 'https://eid.elastos.io',
                        widgets: 'https://api.elastos.io/widgets',
                        images: 'https://api.elastos.io/images',
                    },
                    "TestNet": {
                        mainChainRPC: 'https://api-testnet.elastos.io/ela',
                        // idChainRPC: 'https://api-testnet.elastos.io/did',
                        eidChainRPC: 'https://api-testnet.elastos.io/eid',
                        eidBrowserRPC: 'https://eid-testnet.elastos.io/api',
                        eidOracleRPC: 'https://api-testnet.elastos.io/eid-oracle',
                        escRPC: 'https://api-testnet.elastos.io/esc',
                        escOracleRPC: 'https://api-testnet.elastos.io/esc-oracle',
                        escBrowserRPC: 'https://esc-testnet.elastos.io/api',
                        crRPC: 'https://api.cyberrepublic.org',
                        elaBlockExplorer: 'https://blockchain-testnet.elastos.io',
                        escBlockExplorer: 'https://esc-testnet.elastos.io',
                        eidBlockExplorer: 'https://eid-testnet.elastos.io',
                        widgets: 'https://api-testnet.elastos.io/widgets',
                        images: 'https://api.elastos.io/images',
                    },
                    "LRW": {
                        mainChainRPC: 'https://dpos2.cpolar.top',
                        // idChainRPC: 'https://did1rpc.longrunweather.com:18443',
                        eidChainRPC: 'https://eid02.longrunweather.com:18443',
                        eidBrowserRPC: '',
                        eidOracleRPC: '',
                        escRPC: '',
                        escOracleRPC: '',
                        escBrowserRPC: '',
                        crRPC: 'https://crapi.longrunweather.com:18443',
                        elaBlockExplorer: '',
                        escBlockExplorer: '',
                        eidBlockExplorer: '',
                        widgets: 'https://api.elastos.io/widgets',
                        images: 'https://api.elastos.io/images',
                    },
                }
            },
            {
                key: "elastosio2",
                name: "elastos.io 2",
                description: '', //this.translate.instant('settings.trinity-tech-io-des'),
                endpoints: {
                    "MainNet": {
                        mainChainRPC: 'https://api2.elastos.io/ela',
                        // idChainRPC: 'https://api2.elastos.io/did',
                        eidChainRPC: 'https://api2.elastos.io/eid',
                        eidBrowserRPC: 'https://eid.elastos.io/api',
                        eidOracleRPC: 'https://api2.elastos.io/eid-oracle',
                        escRPC: 'https://api2.elastos.io/esc',
                        escOracleRPC: 'https://api2.elastos.io/esc-oracle',
                        escBrowserRPC: 'https://esc.elastos.io/api',
                        crRPC: 'https://api.cyberrepublic.org',
                        elaBlockExplorer: 'https://blockchain.elastos.io',
                        escBlockExplorer: 'https://esc.elastos.io',
                        eidBlockExplorer: 'https://eid.elastos.io',
                        widgets: 'https://api2.elastos.io/widgets',
                        images: 'https://api2.elastos.io/images',
                    },
                    "TestNet": {
                        mainChainRPC: 'https://api2-testnet.elastos.io/ela',
                        // idChainRPC: 'https://api2-testnet.elastos.io/did',
                        eidChainRPC: 'https://api2-testnet.elastos.io/eid',
                        eidBrowserRPC: 'https://eid-testnet.elastos.io/api',
                        eidOracleRPC: 'https://api2-testnet.elastos.io/eid-oracle',
                        escRPC: 'https://api2-testnet.elastos.io/esc',
                        escOracleRPC: 'https://api2-testnet.elastos.io/esc-oracle',
                        escBrowserRPC: 'https://esc-testnet.elastos.io/api',
                        crRPC: 'https://api.cyberrepublic.org',
                        elaBlockExplorer: 'https://blockchain-testnet.elastos.io',
                        escBlockExplorer: 'https://esc-testnet.elastos.io',
                        eidBlockExplorer: 'https://eid-testnet.elastos.io',
                        widgets: 'https://api2-testnet.elastos.io/widgets',
                        images: 'https://api2.elastos.io/images',
                    },
                    "LRW": {
                        mainChainRPC: 'https://crc1rpc.longrunweather.com:18443',
                        // idChainRPC: 'https://did1rpc.longrunweather.com:18443',
                        eidChainRPC: 'https://eid02.longrunweather.com:18443',
                        eidBrowserRPC: '',
                        eidOracleRPC: '',
                        escRPC: '',
                        escOracleRPC: '',
                        escBrowserRPC: '',
                        crRPC: 'https://crapi.longrunweather.com:18443',
                        elaBlockExplorer: '',
                        escBlockExplorer: '',
                        eidBlockExplorer: '',
                        widgets: 'https://api.elastos.io/widgets',
                        images: 'https://api.elastos.io/images',
                    },
                }
                /*
                {
                    type: 'settings.lrw-net',
                    code: 'LrwNet',
                    mainChainRPCApi: 'http://crc1rpc.longrunweather.com:18080',
                    idChainRPCApi: 'http://did1rpc.longrunweather.com:18080',
                    eidRPCApi: 'http://eid02.longrunweather.com:18080',
                    ethscRPCApi: '',
                    ethscApiMisc: '',
                    ethscOracle: '',
                    ethscBrowserApiUrl: '',
                    crRPCApi: 'http://crapi.longrunweather.com:18080',
                    icon: '/assets/icon/priv.svg'
                },
                {
                    type: 'settings.priv-net',
                    code: 'PrvNet',
                    mainChainRPCApi: 'http://api.elastos.io:22336',
                    idChainRPCApi: 'http://api.elastos.io:22606',
                    eidRPCApi: 'https://api.elastos.io/eid',
                    ethscRPCApi: 'http://api.elastos.io:22636',
                    ethscApiMisc: 'http://api.elastos.io:22634',
                    ethscOracle: 'http://api.elastos.io:22632',
                    ethscBrowserApiUrl: 'https://esc.elastos.io',
                    crRPCApi: 'https://api.cyberrepublic.org',
                    icon: '/assets/icon/priv.svg'
                }
                */
            }
        ];
    }

    async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
        this.languageSubscription = this.language.activeLanguage.subscribe((lang) => {
            // For translation.
            this.initProvidersList();
        });

        // Retrieve user's preferred provider from preferences
        let providerName = await this.prefs.getPreference(signedInIdentity.didString, NetworkTemplateStore.networkTemplate, "elastosapi.provider") as string;
        let provider = this.getProviderByName(providerName);
        if (!provider) {
            // This saved provider doesn't exist any more maybe. Use the default provider.
            Logger.log("elastosapi", "Current provider name could not be found, looking for the default one");
            provider = await this.getDefaultProvider();
            this.activeProvider = new BehaviorSubject(provider);
            await this.useProvider(provider); // Save this preference for later.
        }
        else {
            this.activeProvider = new BehaviorSubject(provider);
        }

        await this.setResolverUrl();

        Logger.log("elastosapi", "User's Elastos API provider is:", this.activeProvider.value);
    }

    onUserSignOut(): Promise<void> {
        if (this.languageSubscription) {
            this.languageSubscription.unsubscribe();
            this.languageSubscription = null;
        }
        return;
    }

    private getProviderByName(providerName: string): ElastosAPIProvider {
        return this.availableProviders.find(p => p.name === providerName);
    }

    /**
     * The default provider to use for a user is the "best" provider, that we tried to auto detect.
     */
    private getDefaultProvider(): Promise<ElastosAPIProvider> {
        return this.findTheBestProvider();
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
        await this.prefs.setPreference(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, "elastosapi.provider", provider.name);
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
    public getApiUrl(type: ElastosApiUrlType, activeNetworkTemplate = this.globalNetworksService.activeNetworkTemplate.value): string {
        let activeProvider = this.activeProvider.value;

        // Make sure the currently active network template is supported by our elastos api providers
        if (!(activeNetworkTemplate in activeProvider.endpoints)) {
            Logger.warn("elastosapi", "Unknown network template " + activeNetworkTemplate + "!");
            return null;
        }

        // Make sure the currently activ eprovider supports the requested API url type
        let endpoints = activeProvider.endpoints[activeNetworkTemplate];
        if (!(type in endpoints)) {
            Logger.warn("elastosapi", "Elastos API provider " + activeProvider.name + " does not support url type " + type + "!");
            return null;
        }

        return endpoints[type];
    }

    /**
     * Tries to find the best elastos API provider for the current user / device. When found, this provider
     * is selected and used as currently active provider for essentials.
     *
     * Calling this method fires the rxjs subject event so that all listeners can adapt to this detected provider.
     *
     * This method does NOT change the active provider for the current user if a user is signed in.
     */
    public async autoDetectTheBestProvider(): Promise<boolean> {
        Logger.log("elastosapi", "Trying to auto detect the best elastos api provider");
        let bestProvider = await this.findTheBestProvider();
        Logger.log("elastosapi", "Best provider found:", bestProvider);

        if (bestProvider) {
            // Use this provider
            this.activeProvider.next(bestProvider);

            // Immediatelly let plugins know about this selected provider, because DID sessions
            // need to set the right resolver urls even if no user is signed in.
            await this.setResolverUrl();
            return true;
        } else {
            return false;
        }
    }

    /**
     * Tries to find the best provider and returns it.
     */
    private _bestProvider: ElastosAPIProvider;
    private async findTheBestProvider(): Promise<ElastosAPIProvider> {
        Logger.log("elastosapi", "Starting to look for the best API provider");

        // To know the best provider, we try to call an api on all of them and then select the fastest
        // one to answer.
        this._bestProvider = null;
        let testPromises: Promise<void>[] = this.availableProviders.map(p => this.callTestAPIOnProvider(p));
        await Promise.race(testPromises);

        if (!this._bestProvider) {
            this._bestProvider = this.availableProviders[0];
        }
        Logger.log("elastosapi", "Got the best API provider", this._bestProvider);

        return this._bestProvider;
    }

    /**
     * Call a test API on a provider to check its speed in findTheBestProvider().
     * - All errors are catched and not forwarded because we don't want Promise.race() to throw, we
     * want it to resolve the first successful call to answer.
     * - API calls that return errors are resolved with a timeout, to make sure they are considered as
     * "slow" but on the other hand that they resolve one day (we can't stack unresolved promises forever).
     */
    private callTestAPIOnProvider(provider: ElastosAPIProvider): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        return new Promise(async (resolve) => {
            let testApiUrl = provider.endpoints["MainNet"].mainChainRPC;

            const param = {
                method: 'getblockcount',
            };

            try {
                let data = await this.globalJsonRPCService.httpPost(testApiUrl, param);
                Logger.log("elastosapi", "Provider " + provider.name + " just answered the test api call with value (block height) ", data);
                // Set the provider as best provider if no one did that yet. We are the fastest api call to answer.
                if (!this._bestProvider)
                    this._bestProvider = provider;
                resolve();
            } catch (e) {
                Logger.warn("elastosapi", "Auto detect api call to " + testApiUrl + " failed with error:", e);
                // Resolve later, to let othe providers answer faster
                setTimeout(() => {
                    resolve();
                }, 30000); // 30s
            }
        });
    }

    /**
     * Globally, updates plugins to use a different DID resolver depending on which Elastos API provider is used.
     * This can happen when a different user signs in (has a different elastos api provider in preferences) or when
     * the same user manually changes his elastos api provider from settings.
     */
    private setupDIDResolver() {
        this.activeProvider.subscribe((provider) => {
            if (provider) {
                void this.setResolverUrl();
            }
        });
    }

    private async setResolverUrl(): Promise<void> {
        let didResolverUrl = this.getApiUrl(ElastosApiUrlType.EID_RPC);

        Logger.log('elastosapi', 'Changing DID plugin resolver in DID and Hive plugins to :', didResolverUrl);
        // DID Plugin
        await new Promise<void>((resolve, reject) => {
            didManager.setResolverUrl(didResolverUrl, () => {
                resolve();
            }, (err) => {
                Logger.error('elastosapi', 'didplugin setResolverUrl error:', err);
                reject(err);
            });
        });

        const { AppContext, DIDResolverAlreadySetupException } = await lazyElastosHiveSDKImport();

        // Hive plugin
        try {
            AppContext.setupResolver(didResolverUrl, "/anyfakedir/browserside/for/didstores");
        }
        catch (e) {
            if (e instanceof DIDResolverAlreadySetupException) {
                // silent error, it's ok
            }
            else {
                console.error("AppContext.setupResolver() exception:", e);
            }
        }
    }

    ////////////////
    ///// APIS /////
    ////////////////

    public getApiUrlForChainCode(elastosChainCode: StandardCoinName): string {
        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        return this.getApiUrl(apiurltype);
    }

    public getApiUrlTypeForRpc(elastosChainCode: string): ElastosApiUrlType {
        switch (elastosChainCode) {
            case StandardCoinName.ELA:
                return ElastosApiUrlType.ELA_RPC;
            case StandardCoinName.ETHSC:
                return ElastosApiUrlType.ETHSC_RPC;
            case StandardCoinName.ETHDID:
                return ElastosApiUrlType.EID_RPC;
            default:
                throw new Error('RPC can not support elastos chain code ' + elastosChainCode);
        }
    }

    public getApiUrlTypeForBrowser(elastosChainCode: string) {
        let apiUrlType = null;
        switch (elastosChainCode) {
            case StandardCoinName.ETHSC:
                apiUrlType = ElastosApiUrlType.ETHSC_BROWSER;
                break;
            case StandardCoinName.ETHDID:
                apiUrlType = ElastosApiUrlType.EID_BROWSER;
                break;
            default:
                throw new Error('Elastos API: Browser api can not support ' + elastosChainCode);
        }
        return apiUrlType;
    }

    public getApiUrlTypeForBlockExplorer(elastosChainCode: string) {
        let apiUrlType = null;
        switch (elastosChainCode) {
            case StandardCoinName.ELA:
                apiUrlType = ElastosApiUrlType.ELA_BLOCK_EXPLORER;
                break;
            case StandardCoinName.ETHSC:
                apiUrlType = ElastosApiUrlType.ESC_BLOCK_EXPLORER;
                break;
            case StandardCoinName.ETHDID:
                apiUrlType = ElastosApiUrlType.EID_BLOCK_EXPLORER;
                break;
            default:
                throw new Error('Elastos API: Block explorer api can not support ' + elastosChainCode);
        }
        return apiUrlType;
    }

    // ETHSC:Get the real target address for the send transaction from ethsc to mainchain.
    public async getETHSCWithdrawTargetAddress(blockHeight: number, txHash: string) {
        const param = {
            method: 'getwithdrawtransactionsbyheight',
            params: {
                height: blockHeight
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ETHSC_ORACLE);

        try {
            const result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param);
            for (var i = 0; i < result.length; i++) {
                if ('0x' + result[i].txid === txHash) {
                    // TODO: crosschainassets has multiple value?
                    // TODO: define the result type
                    return result[i].crosschainassets[0].crosschainaddress;
                }
            }
        } catch (e) {
            Logger.warn("elastosapi", "getETHSCWithdrawTargetAddress exception", e);
        }

        return '';
    }

    async getRawTransaction(txid: string, elastosChainCode = StandardCoinName.ELA): Promise<TransactionDetail> {
        const param = {
            method: 'getrawtransaction',
            params: {
                txid: txid,
                verbose: true
            },
        };

        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        if (rpcApiUrl === null) {
            return null;
        }

        let rawtransaction = null;
        try {
            rawtransaction = await this.globalJsonRPCService.httpPost(rpcApiUrl, param);
        } catch (e) {
            Logger.warn("elastosapi", "getRawTransaction exception", e);
        }

        return rawtransaction;
    }

    public async getTransactionsByAddress(elastosChainCode: StandardCoinName, addressArray: string[], limit: number, skip = 0, timestamp = 0): Promise<{ result: ElastosPaginatedTransactions }[]> {
        const paramArray = [];
        let index = 0;

        if (!addressArray || addressArray.length === 0) {
            throw new Error("Elastos API - getTransactionsByAddress() cannot be called with an empty address array");
        }

        for (const address of addressArray) {
            const param = {
                method: 'gethistory',
                params: {
                    address,
                    limit,
                    skip,
                    timestamp
                },
                id: index.toString()
            };
            index++;
            paramArray.push(param);
        }

        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        if (rpcApiUrl === null) {
            return [];
        }

        let transactionsArray = null;
        try {
            transactionsArray = await this.globalJsonRPCService.httpPost(rpcApiUrl, paramArray);
        } catch (e) {
            Logger.warn("elastosapi", "getTransactionsByAddress exception", e);
        }

        if (transactionsArray === null) {
            return [];
        } else {
            return transactionsArray.filter(c => {
                return c.result && (c.result.totalcount > 0);
            });
        }
    }

    public async getERC20TokenTransactions(elastosChainCode: StandardCoinName, address: string): Promise<EthTokenTransaction[]> {
        let apiurltype = this.getApiUrlTypeForBrowser(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        const ethscgetTokenTxsUrl = rpcApiUrl + '?module=account&action=tokentx&address=' + address;

        try {
            let result = await this.globalJsonRPCService.httpGet(ethscgetTokenTxsUrl);
            if (result) {
                let resultItems = result.result as EthTokenTransaction[];
                return resultItems;
            } else return [];
        } catch (e) {
            Logger.warn("elastosapi", "getERC20TokenTransactions exception", e);
            return [];
        }
    }

    public async getERC20TokenList(elastosChainCode: StandardCoinName, address: string): Promise<ERCTokenInfo[]> {
        let apiurltype = this.getApiUrlTypeForBrowser(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        const ethscgetTokenListUrl = rpcApiUrl + '?module=account&action=tokenlist&address=' + address;

        try {
            let result = await this.globalJsonRPCService.httpGet(ethscgetTokenListUrl);
            if (result) {
                return result.result as ERCTokenInfo[];
            } else return [];
        } catch (e) {
            Logger.warn("elastosapi", "getERC20TokenList exception", e);
            return [];
        }
    }

    // return all utxo by address
    public async getAllUtxoByAddress(elastosChainCode: StandardCoinName, addresses: string[], utxotype: UtxoType = UtxoType.Mixed): Promise<any> {
        const param = {
            method: 'listunspent',
            params: {
                addresses,
                utxotype,
                spendable: true // Coinbase utxo must be confirmed more than 100 times.
            },
        };

        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        if (rpcApiUrl === null) {
            return [];
        }

        let utxoArray = null;
        try {
            utxoArray = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 30000, false, true);
        } catch (e) {
            Logger.warn("elastosapi", "getAllUtxoByAddress exception", e);
        }

        return utxoArray;
    }

    // get the spendable utxos by amount.
    public async getUtxosByAmount(elastosChainCode: StandardCoinName, address: string, amount: string, utxotype: UtxoType = UtxoType.Mixed): Promise<any> {
        const param = {
            method: 'getutxosbyamount',
            params: {
                address,
                amount, // The unit is ELA.
                utxotype
            },
        };

        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        if (rpcApiUrl === null) {
            return [];
        }

        let utxoArray = null;
        try {
            utxoArray = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
        } catch (e) {
            Logger.error('elastosapi', 'getUtxosByAmount error:', e)
        }

        return utxoArray;
    }

    public async getBlockCount(elastosChainCode: StandardCoinName) {
        const param = {
            method: 'getblockcount',
        };

        let apiurltype = this.getApiUrlTypeForRpc(elastosChainCode);
        const rpcApiUrl = this.getApiUrl(apiurltype);
        if (rpcApiUrl === null) {
            return 0;
        }

        let blockHeight = 0;
        try {
            const blockHeightStr = await this.globalJsonRPCService.httpPost(rpcApiUrl, param);
            blockHeight = parseInt(blockHeightStr, 10);
        } catch (e) {
            Logger.warn("elastosapi", "getBlockCount exception", e);
        }
        return blockHeight;
    }

    public async getCurrentHeight() {
        // Logger.warn("elastosapi", "getCurrentHeight ");
        if (this.blockHeightCache) {
            let current = moment().valueOf();
            if ((current - this.blockHeightTimestamp) < 60000) { // 60s
                return this.blockHeightCache
            }
        }
        const param = {
            method: 'getcurrentheight',
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);
        if (rpcApiUrl === null) {
            return 0;
        }

        try {
            let blockHeight = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            if (blockHeight) {
                this.blockHeightTimestamp = moment().valueOf();
                this.blockHeightCache = blockHeight;
                return blockHeight;
            }
        } catch (e) {
            Logger.warn("elastosapi", "getCurrentHeight exception", e);
        }

        // use cache value.
        return this.blockHeightCache;
    }

    public async getELABlockHash(blockHeight: number) {
        const param = {
            method: 'getblockhash',
            params: {
                height: blockHeight
            }
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);
        if (rpcApiUrl === null) {
            return '';
        }

        try {
            return await this.globalJsonRPCService.httpPost(rpcApiUrl, param);
        } catch (e) {
            Logger.warn("elastosapi", "getBlockHash exception", e);
        }
        return '';
    }

    async getBlockByHeight(currentHeight: number): Promise<any> {
        const param = {
            method: 'getblockbyheight',
            params: {
                height: currentHeight
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);
        if (rpcApiUrl === null) {
            return null;
        }

        try {
            const result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            return result;
        }
        catch (e) {
            Logger.warn("elastosapi", "getBlockByHeight exception", e);
        }

        return null;
    }

    // identity:
    // v1: identity == DPoSV1V2 or identity == DPoSV1
    // v2: identity == DPoSV1V2 or identity == DPoSV2
    // all: return all nodes.
    public async fetchDposNodes(state, identity = NodeType.ALL): Promise<ProducersSearchResponse> {
        Logger.log('elastosapi', 'Fetching Dpos Nodes ', identity);

        // check cache
        let useCache = false;
        if (state == 'all') {
           useCache = true;
           let current = moment().valueOf();
           if (this.nodesCache[identity] && ((current - this.nodesCache[identity].timestamp) < 120000)) {
              return this.nodesCache[identity].result;
           }
        }

        const param = {
            method: 'listproducers',
            params: {
                state: state,
                identity: identity
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        try {
            const dposNodes = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 20000, false, true);
            if (useCache) {
                this.nodesCache[identity] = {
                    timestamp: moment().valueOf(),
                    result: dposNodes
                }
            }
            return dposNodes;
        } catch (e) {
            Logger.warn("elastosapi", "fetchDposNodes exception", e);
        }
        return null;
    }

    // BPoS
    public async getVoteRights(stakeAddresses: string): Promise<StakeInfo[]> {
        Logger.log('elastosapi', 'Get Vote Rights.. stakeAddresses:', stakeAddresses);
        const param = {
            method: 'getvoterights',
            params: {
                stakeaddresses: [stakeAddresses]
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        try {
            return await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
        } catch (e) {
            Logger.warn("elastosapi", "getVoteRights exception", e);
        }
        return null;
    }

    //crc
    public async getCRrelatedStage() {
        let current = moment().valueOf();
        if (this.crRelatedStageCache && ((current - this.crRelatedStageCache.timestamp) < 120000)) {
            return this.crRelatedStageCache.result;
        }

        const param = {
            method: 'getcrrelatedstage',
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            if (result) {
                this.crRelatedStageCache = {
                    timestamp: current,
                    result: result
                }
            }
        } catch (e) {
            Logger.warn("elastosapi", "getCRrelatedStage exception", e);
        }
        return result;
    }

    public async getCRMembers() {
        let current = moment().valueOf();
        if (this.crMembersCache && ((current - this.crMembersCache.timestamp) < 120000)) {
            return this.crMembersCache.result;
        }

        const param = {
            method: 'listcurrentcrs',
            params: {
                state: "all"
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            if (result) {
                this.crMembersCache = {
                    timestamp: current,
                    result: result
                }
            }
        } catch (e) {
            Logger.warn("elastosapi", "getCRMembers exception", e);
        }
        return result;
    }

    public async getSecretaryGeneral() {
        let current = moment().valueOf();
        // The Secretary General's message will never be changed?
        if (this.crSecretaryGeneralCache && ((current - this.crSecretaryGeneralCache.timestamp) < 120000)) {
            return this.crSecretaryGeneralCache.result;
        }

        const param = {
            method: 'getsecretarygeneral',
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            if (result) {
                this.crSecretaryGeneralCache = {
                    timestamp: current,
                    result: result
                }
            }
        } catch (e) {
            Logger.warn("elastosapi", "getCRMembers exception", e);
        }
        return result;
    }

    public async fetchCRcouncil(index = 0): Promise<CRCouncilSearchResponse> {
        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.CR_RPC);

        let crfetchCRCurl = rpcApiUrl + '/api/council/list/';
        if (index > 0) {
            crfetchCRCurl += index
        }
        try {
            let result = await this.globalJsonRPCService.httpGet(crfetchCRCurl);
            return result;
        } catch (e) {
            Logger.error('elastosapi', 'fetchCRcouncil error:', e)
        }
        return null;
    }

    async getCRMemberInfo(did: string): Promise<CRMemberInfo> {
        try {
            const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.CR_RPC);
            const councilUrl = rpcApiUrl + '/api/v2/council/information/' + did;
            let result = await this.globalJsonRPCService.httpGet(councilUrl);
            return  result?.data;
        }
        catch (err) {
            Logger.error('elastosapi', 'getCRMemberInfo error:', err);
        }

        return null;
    }

    // id: cid or did
    public async getCRMember(id: string) {
        const param = {
            method: 'getcrmember',
            params: {
                id: id,
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
        } catch (e) {
            Logger.warn("elastosapi", "getCRMember exception", e);
        }
        return result;
    }

    public async getCRCandidates(): Promise<any> {
        let current = moment().valueOf();
        if (this.crCandidatesCache && ((current - this.crCandidatesCache.timestamp) < 120000)) {
            return this.crCandidatesCache.result;
        }

        const param = {
            method: 'listcrcandidates',
            params: {
                state: "all"
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param, 'default', 10000, false, true);
            if (result) {
                this.crCandidatesCache = {
                    timestamp: current,
                    result: result
                }
            }
            return result;
        } catch (e) {
            Logger.warn("elastosapi", "getCRCandidates exception", e);
        }
        return result;
    }

    public async fetchProposals(status: CRProposalStatus): Promise<CRProposalsSearchResponse> {
        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.CR_RPC);
        const crfetchproposalsurl = rpcApiUrl + '/api/cvote/all_search?status=' + status + '&page=1&results=-1';
        try {
            let result = await this.globalJsonRPCService.httpGet(crfetchproposalsurl);
            return result;
        } catch (e) {
            Logger.error('elastosapi', 'fetchProposals error:', e)
        }
        return null;
    }

    public async fetchProposalDetails(proposalHash: string): Promise<ProposalDetails> {
        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.CR_RPC);
        const crfetchproposalsurl = rpcApiUrl + '/api/v2/proposal/get_proposal/' + proposalHash;
        try {
            let result = await this.globalJsonRPCService.httpGet(crfetchproposalsurl);
            return result?.data;
        } catch (e) {
            Logger.error('elastosapi', 'fetchProposalDetails error:', e)
        }
        return null;
    }

    // images
    public async fetchImages(): Promise<ImageInfos> {
      if (this.imagesCache) {
          return this.imagesCache;
      }

      const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.IMAGES);
      const imagesurl = rpcApiUrl + '/logo.json';
      try {
          let result = await this.globalJsonRPCService.httpGet(imagesurl);
          if (result && (Object.keys(result).length > 0)) {
              this.imagesCache = result;
              return result;
          }
      } catch (e) {
          Logger.error('elastosapi', 'fetchImages error:', e)
      }
      return null;
    }

    // BPoS NFT
    /**
     *
     * @param nftId
     * @returns
     */
    async getBPoSNFTInfo(nftId: string): Promise<BPoSNFTInfo> {
        const param = {
            method: 'getnftinfo',
            params: {
                id: nftId,
            },
        };

        const rpcApiUrl = this.getApiUrl(ElastosApiUrlType.ELA_RPC);
        if (rpcApiUrl === null) {
            return null;
        }

        let result = null;
        try {
            result = await this.globalJsonRPCService.httpPost(rpcApiUrl, param);
        } catch (e) {
            Logger.warn("elastosapi", "getBPoSNFTInfo exception", e);
        }

        return result;
    }

}
