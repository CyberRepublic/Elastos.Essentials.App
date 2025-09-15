// import { Logger } from 'src/app/logger';
// import { Config } from '../../../../../../config/Config';
// import { AccountAbstractionTransaction } from '../../../../../../services/account-abstraction/model/account-abstraction-transaction';
// import { AnyEVMNetworkWallet } from '../../../../evms/networkwallets/evm.networkwallet';
// import { EcoSubWallet } from '../../eco/subwallets/eco.evm.subwallet';

// /**
//  * Account Abstraction subwallet for Elastos ECO chain
//  * Handles AA-specific transaction creation and signing
//  */
// export class EcoAccountAbstractionSubWallet extends EcoSubWallet {
//   constructor(networkWallet: AnyEVMNetworkWallet) {
//     super(networkWallet);
//   }

//   public async initialize() {
//     await super.initialize();

//     this.withdrawContractAddress = Config.ETHECO_WITHDRAW_ADDRESS.toLowerCase();
//   }

//   public getCrossChainFee(): number {
//     // The minimum gas price set for eco sidechain is 50, The gas limit for cross chain transactions is approximately 21512,
//     // so the fee set in the SDK is 150000.
//     return 150000;
//   }

//   /**
//    * Override signAndSendRawTransaction to handle AA-specific bundling
//    */
//   public async signAndSendRawTransaction(
//     rawTransaction: any,
//     transfer: any,
//     navigateHomeAfterCompletion = true,
//     forcePasswordPrompt = true,
//     visualFeedback = true
//   ): Promise<any> {
//     Logger.log('wallet', 'EcoAccountAbstractionSubWallet signAndSendRawTransaction:', rawTransaction);

//     // For AA, delegate to the AA network wallet which handles the proper transaction flow
//     // including loader display and status management
//     const aaNetworkWallet = this.networkWallet as any; // AccountAbstractionNetworkWallet
//     const aaTransaction = rawTransaction as AccountAbstractionTransaction;

//     const transactionHash = await aaNetworkWallet.signAndSendRawTx(aaTransaction);

//     return {
//       published: !!transactionHash,
//       txid: transactionHash,
//       status: transactionHash ? 'published' : 'error'
//     };
//   }
// }
