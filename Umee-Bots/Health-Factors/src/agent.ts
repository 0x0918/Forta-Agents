import {
  BlockEvent,
  Finding,
  HandleBlock,
  HandleTransaction,
  TransactionEvent,
  ethers,
  getEthersProvider,
  Initialize,
} from "forta-agent";
import { Contract as MulticallContract, Provider as MulticallProvider } from "ethers-multicall";
import BigNumber from "bignumber.js";

import { BORROW_ABI, GET_USER_ACCOUNT_DATA_ABI, LATEST_ANSWER_ABI } from "./constants";
import { AccountData, AgentConfig, arrayChunks, createFinding, ethersBnToBn } from "./utils";
import CONFIG from "./agent.config";

BigNumber.set({ DECIMAL_PLACES: 18 });

let accounts: Array<{ address: string; alerted: boolean }> = [];
let multicallProvider: MulticallProvider;

export const provideInitialize = (provider: ethers.providers.Provider): Initialize => {
  return async () => {
    multicallProvider = new MulticallProvider(provider);
    await multicallProvider.init();
  };
};

export const provideHandleTransaction = (config: AgentConfig): HandleTransaction => {
  return async (txEvent: TransactionEvent): Promise<Finding[]> => {
    const users = txEvent.filterLog(BORROW_ABI, config.lendingPoolAddress).map((el) => el.args.onBehalfOf);

    accounts.push(...users.map((el) => ({ address: el, alerted: false })));

    return [];
  };
};

export const provideHandleBlock = (provider: ethers.providers.Provider, config: AgentConfig): HandleBlock => {
  const LendingPool = new MulticallContract(config.lendingPoolAddress, [GET_USER_ACCOUNT_DATA_ABI]);
  const EthUsdFeed = new ethers.Contract(config.ethUsdFeedAddress, [LATEST_ANSWER_ABI], provider);

  return async (_: BlockEvent): Promise<Finding[]> => {
    const findings: Finding[] = [];

    if (!accounts.length) {
      return [];
    }

    const ethToUsd = ethersBnToBn(await EthUsdFeed.latestAnswer(), 8);

    // divide accounts into chunks and make multiple multicalls if necessary so a large multicall is avoided
    const accountsData = (
      await Promise.all(
        arrayChunks(accounts, 10).map((chunk) => {
          return multicallProvider.all(chunk.map((el) => LendingPool.getUserAccountData(el.address)));
        })
      )
    ).flat() as AccountData[];

    (await multicallProvider.all(accounts.map((el) => LendingPool.getUserAccountData(el.address)))) as AccountData[];

    accounts = accounts.filter((account, idx) => {
      const accountData = accountsData[idx];
      const totalDebtUsd = ethersBnToBn(accountData.totalDebtETH, 18).times(ethToUsd);
      const totalCollateralUsd = ethersBnToBn(accountData.totalCollateralETH, 18).times(ethToUsd);

      if (totalDebtUsd.isLessThan(config.ignoreThreshold)) {
        return false;
      }

      const healthFactor = ethersBnToBn(accountData.healthFactor, 18);
      const lowHealthFactor = healthFactor.isLessThan(config.healthFactorThreshold);
      const largeCollateralAmount = totalCollateralUsd.isGreaterThan(config.upperThreshold);

      if (lowHealthFactor) {
        if (!account.alerted && largeCollateralAmount) {
          findings.push(createFinding(account.address, healthFactor, totalCollateralUsd));
          account.alerted = true;
        }
      } else if (account.alerted) {
        // if a previously underwater borrow is now properly repaid, make it eligible again for a possible
        // future finding
        account.alerted = false;
      }

      return true;
    });

    return findings;
  };
};

export default {
  provideInitialize,
  initialize: provideInitialize(getEthersProvider()),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(CONFIG),
  provideHandleBlock,
  handleBlock: provideHandleBlock(getEthersProvider(), CONFIG),

  // testing
  getAccounts: () => accounts,
  resetAccounts: () => (accounts = []),
};
