import { TESTNET_TEMPLATE } from "src/app/services/global.networks.service";
import { CronosBaseNetwork } from "./cronos.base.network";

export class CronosTestNetNetwork extends CronosBaseNetwork {

  constructor() {
    super("cronos",
      "Cronos Testnet",
      "Cronos Testnet",
      "assets/wallet/networks/cronos.png",
      "tCRO",
      "CRO",
      TESTNET_TEMPLATE,
      338,
      [],
      [
        {
          name: 'Cronos Testnet RPC',
          url: 'https://evm-t3.cronos.org'
        }
      ]
    );

    this.averageBlocktime = 5;
  }
}
