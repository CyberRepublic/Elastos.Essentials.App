import { TESTNET_TEMPLATE } from "src/app/services/global.networks.service";
import { CeloBaseNetwork } from "./celo.base.network";

export class CeloTestNetNetwork extends CeloBaseNetwork {
  constructor() {
    super("celo",
      "Celo Alfajores Testnet",
      "Celo Alfajores Testnet",
      "assets/wallet/networks/celo.svg",
      "CELO",
      "Celo Coin",
      TESTNET_TEMPLATE,
      44787,
      [],
      [
        {
          name: 'Celo Testnet RPC',
          url: 'https://alfajores-forno.celo-testnet.org'
        }
      ]
    );

    this.averageBlocktime = 5
  }
}
