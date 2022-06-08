import { Finding, HandleTransaction, TransactionEvent, getEthersProvider } from "forta-agent";
import { providers, BigNumber } from "ethers";
import NetworkManager from "./network";
import NetworkData from "./network";
import { SWAP_ABI, PAIR_ABI, create2Pair } from "./utils";
import { createFinding } from "./findings";
import { MulticallContract, MulticallProvider } from "./multicall2";

const THRESHOLD_PERCENTAGE: number = 20;

const networkManager: NetworkData = new NetworkManager();

export const provideInitialize = (provider: providers.Provider) => async () => {
  const { chainId } = await provider.getNetwork();
  networkManager.setNetwork(chainId);
};

export function provideHandleTransaction(
  provider: providers.Provider,
  networkManager: NetworkData,
  thresholdPercentage: number
): HandleTransaction {
  return async (txEvent: TransactionEvent): Promise<Finding[]> => {
    const findings: Finding[] = [];

    await Promise.all(
      // Filter for any `Swap` event emissions
      txEvent.filterLog(SWAP_ABI).map(async (log) => {
        // Assign the `Swap` arguments to variables
        const [, amount0In, amount1In, amount0Out, amount1Out] = log.args;

        let multicall2: MulticallProvider;

        const { chainId } = await provider.getNetwork();
        if (chainId === 43114) {
          multicall2 = new MulticallProvider(provider, { 43114: networkManager.multicall2 }, 43114);
        } else {
          multicall2 = new MulticallProvider(provider, { 42: networkManager.multicall2 }, 42);
        }

        const pairContract = new MulticallContract(log.address, PAIR_ABI);
        const tokenResults = await multicall2.all([pairContract.token0(), pairContract.token1()], txEvent.blockNumber);

        const token0 = tokenResults[0]["returnData"];
        const token1 = tokenResults[1]["returnData"];

        // Check if the emitting address is a valid pair contract
        // by comapring to `create2` output
        const create2PairAddress: string = create2Pair(
          token0.toLowerCase(),
          token1.toLowerCase(),
          networkManager.factory,
          networkManager.pairInitCodeHash
        );
        if (create2PairAddress === log.address) {
          const reservesResults = await multicall2.all([pairContract.getReserves()], txEvent.blockNumber - 1);

          const [reserve0, reserve1] = reservesResults[0]["returnData"];

          // Create threshold amounts
          const reserve0Threshold: BigNumber = reserve0.mul(thresholdPercentage).div(100);
          const reserve1Threshold: BigNumber = reserve1.mul(thresholdPercentage).div(100);

          // If the `amount` arguments from `Swap` are large relative
          // to their respective `reserve`, create a finding
          if (
            amount0In.gte(reserve0Threshold) ||
            amount0Out.gte(reserve0Threshold) ||
            amount1In.gte(reserve1Threshold) ||
            amount1Out.gte(reserve1Threshold)
          ) {
            findings.push(createFinding(log.args));
          }
        }
      })
    );

    return findings;
  };
}

export default {
  initialize: provideInitialize(getEthersProvider()),
  handleTransaction: provideHandleTransaction(getEthersProvider(), networkManager, THRESHOLD_PERCENTAGE),
};
