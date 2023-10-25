!function(e){"function"==typeof define&&define.amd?define(e):e()}((function(){"use strict";const e=new class{};const t=new class{constructor(){this.callbacks=new Map}postMessage(e,t){let s=Date.now()+Math.floor(1e5*Math.random());return console.log("EssentialsBridge: postMessage",e,s,t),new Promise(((r,n)=>{this.callbacks.set(s,{resolve:r,reject:n});let i={id:s,name:e,object:t};window.webkit.messageHandlers.essentialsExtractor.postMessage(JSON.stringify(i))}))}sendResponse(e,t){console.log("EssentialsBridge: sendResponse",e,t),this.callbacks.get(e).resolve(t)}sendError(e,t){console.log("EssentialsBridge: sendError",e,t),this.callbacks.get(e)&&(this.callbacks.get(e).reject(t),this.callbacks.delete(e))}};var s;!function(e){e.REQUEST_CREDENTIALS="REQUEST_CREDENTIALS",e.IMPORT_CREDENTIALS="IMPORT_CREDENTIALS"}(s||(s={}));const r={};function n(e,t){r[e]=t}async function i(e){const t=await(r[e.type]?.(e));a?.(e.requestPayload.requestId,t)}let a=null;class o{static registerResponseProcessors(){n(s.REQUEST_CREDENTIALS,o.processRequestCredentialsResponse),n(s.IMPORT_CREDENTIALS,o.processImportCredentialsResponse)}static async getCredentials(s){console.log("getCredentials request received",s);let r=await t.postMessage("elastos_getCredentials",s);return console.log("getCredentials response received",r),e.didSdk.VerifiablePresentation.parse(JSON.stringify(r))}static async requestCredentials(t){console.log("requestCredentials request received",t);let s=await this.postEssentialsUrlIntent("https://did.elastos.net/requestcredentials",{request:t});return console.log("requestCredentials response received",s),e.didSdk.VerifiablePresentation.parse(s.presentation)}static async requestCredentialsV2(e,t){this.processRequestCredentials(e,t)}static async processRequestCredentials(e,t){let r=await this.requestCredentials(t);i({id:e,type:s.REQUEST_CREDENTIALS,requestPayload:{caller:this.getApplicationDID(),requestId:e},responsePayload:r})}static async processRequestCredentialsResponse(e){return e.responsePayload}static async importCredentials(t,s){console.log("importCredentials request received",t,s);let r={credentials:t.map((e=>JSON.parse(e.toString())))};s&&s.forceToPublishCredentials&&(r.forceToPublishCredentials=!0);let n,i=await this.postEssentialsUrlIntent("https://did.elastos.net/credimport",r);return n=i.importedcredentials.map((t=>({id:e.didSdk.DIDURL.from(t)}))),console.log("importCredentials response received",i),n}static async importCredentialsV2(e,t,s){this.processImportCredentials(e,t)}static async processImportCredentials(e,t,r){let n=await this.importCredentials(t);i({id:e,type:s.IMPORT_CREDENTIALS,requestPayload:{caller:this.getApplicationDID(),requestId:e},responsePayload:n})}static async processImportCredentialsResponse(e){return e.responsePayload}static async signData(e,s,r){console.log("signData request received",e,s,r);let n=await t.postMessage("elastos_signData",{data:e,jwtExtra:s,signatureFieldName:r});return console.log("signData response received",n),n}static async deleteCredentials(e,t){console.log("deleteCredentials request received",e,t);let s=await this.postEssentialsUrlIntent("https://did.elastos.net/creddelete",{credentialsids:e,options:t});return console.log("deleteCredentials response received",s),s&&s.deletedcredentialsids?s.deletedcredentialsids:null}static async generateAppIdCredential(t,s){console.log("generateAppIdCredential request received",t,s);let r=await this.postEssentialsUrlIntent("https://did.elastos.net/appidcredissue",{appinstancedid:t,appdid:s});return console.log("generateAppIdCredential response received",r),r&&r.credential?e.didSdk.VerifiableCredential.parse(r.credential):null}static async updateHiveVaultAddress(e,t){console.log("updateHiveVaultAddress request received",e,t);let s=await this.postEssentialsUrlIntent("https://did.elastos.net/sethiveprovider",{address:e,name:t});return console.log("updateHiveVaultAddress response received",s),s&&s.status?s.status:null}static async issueCredential(t,s,r,n,i){console.log("issueCredential request received",t,s,r,n,i);let a=await this.postEssentialsUrlIntent("https://did.elastos.net/credissue",{subjectdid:t,types:s,properties:r,identifier:n,expirationDate:i});return console.log("issueCredential response received",a),a&&a.credential?e.didSdk.VerifiableCredential.parse(a.credential):null}static async generateHiveBackupCredential(t,s,r){console.log("generateHiveBackupCredential request received",t,s,r);let n=await this.postEssentialsUrlIntent("https://did.elastos.net/hivebackupcredissue",{sourceHiveNodeDID:t,targetHiveNodeDID:s,targetNodeURL:r});return console.log("generateHiveBackupCredential response received",n),n&&n.credential?e.didSdk.VerifiableCredential.parse(n.credential):null}static async postEssentialsUrlIntent(e,s){let r=this.getApplicationDID();return r&&(s.caller=r),t.postMessage("elastos_essentials_url_intent",{url:e,params:s})}static getApplicationDID(){try{return e.connectivity.getApplicationDID()}catch{}}}class l{static async onBoard(e,t,s,r){console.log("onBoard request received",e,t,s,r),await this.postEssentialsUrlIntent("https://essentials.elastos.net/onboard",{feature:e,title:t,introduction:s,button:r})}static async postEssentialsUrlIntent(s,r){try{r.caller=e.connectivity.getApplicationDID()}catch{}return t.postMessage("elastos_essentials_url_intent",{url:s,params:r})}}window.EssentialsDABConnector=class{constructor(){this.name="essentialsiab",this.alreadyRegisterConnector=!1,this.registerResponseProcessors()}async getDisplayName(){return"Elastos Essentials In App Browser"}getWeb3Provider(){return window.ethereum}async setModuleContext(t,s){if(e.didSdk=t,e.connectivity=s,!this.alreadyRegisterConnector)try{e.connectivity.registerConnector(this),this.alreadyRegisterConnector=!0}catch(e){console.log("registerConnector error:",e)}}ensureContextSet(){if(!e.didSdk||!e.connectivity)throw new Error("This dApp uses a old version of the elastos connectivity SDK and must be upgraded to be able to run inside Elastos Essentials")}registerResponseProcessors(){o.registerResponseProcessors()}registerResponseHandler(e){console.log("Registered response handler on the EssentialsDABConnector"),(e=>{a=e})(e)}getCredentials(e){return this.ensureContextSet(),o.getCredentials(e)}requestCredentials(e){return this.ensureContextSet(),o.requestCredentials(e)}requestCredentialsV2(e,t){return this.ensureContextSet(),o.requestCredentialsV2(e,t)}issueCredential(e,t,s,r,n){return this.ensureContextSet(),o.issueCredential(e,t,s,r,n)}importCredentials(e,t){return this.ensureContextSet(),o.importCredentials(e,t)}importCredentialsV2(e,t,s){return this.ensureContextSet(),o.importCredentialsV2(e,t,s)}signData(e,t,s){return this.ensureContextSet(),o.signData(e,t,s)}deleteCredentials(e,t){return this.ensureContextSet(),o.deleteCredentials(e,t)}requestPublish(){throw new Error("Method not implemented.")}generateAppIdCredential(e,t){return this.ensureContextSet(),o.generateAppIdCredential(e,t)}updateHiveVaultAddress(e,t){return this.ensureContextSet(),o.updateHiveVaultAddress(e,t)}importCredentialContext(e,t){throw new Error("importCredentialContext(): Method not implemented.")}generateHiveBackupCredential(e,t,s){return this.ensureContextSet(),o.generateHiveBackupCredential(e,t,s)}pay(e){throw new Error("Method not implemented.")}voteForDPoS(){throw new Error("Method not implemented.")}voteForCRCouncil(){throw new Error("Method not implemented.")}voteForCRProposal(){throw new Error("Method not implemented.")}sendSmartContractTransaction(e){throw new Error("Method not implemented.")}onBoard(e,t,s,r){return l.onBoard(e,t,s,r)}sendResponse(e,s){t.sendResponse(e,s)}sendError(e,s){t.sendError(e,s)}}}));
