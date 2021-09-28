import { Finding, HandleTransaction, TransactionEvent } from "forta-agent";
import provideBigQueuedPriceDeviationHandler, {
  createFinding,
} from "./big.queued.price.deviation";
import {
  TestTransactionEvent,
  createAddress,
} from "@nethermindeth/general-agents-module";
import Web3 from "web3";

const CONTRACT_ADDRESSES = [
  createAddress("0x1"),
  createAddress("0x2"),
  createAddress("0x3"),
  createAddress("0x4"),
];

const PEEK_FUNCTION_SELECTOR = "0x59e02dd7";

const web3: Web3 = new Web3();

describe("Big deviation queued price Tests", () => {
  let handleTransaction: HandleTransaction;

  it("should returns empty findings if there are not traces", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent();

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns a finding when the new price deviate too much", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [107, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[0],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      );

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([createFinding(CONTRACT_ADDRESSES[0])]);
  });

  it("should returns empty findings if the new price doesn't deviate too much", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [105, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[0],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      );

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns empty findings if the Peek function wasn't called from the correct contract", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      [CONTRACT_ADDRESSES[0]]
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[1],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [108, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[1],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      );

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns empty findings if Peek function wasn't called", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: "0x11111111",
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [108, true]),
      });

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns empty findings if the Peek call wasn't successful", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(
          ["uint128", "bool"],
          [108, false]
        ),
      });

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns empty findings if the event with deviated price is not emmited from the correct address", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [108, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[1],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      )
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[0],
        [],
        web3.eth.abi.encodeParameter("uint128", 105)
      );


    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it("should returns multiple findings if there are multiple Oracles with big deviations in new prices", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [108, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[0],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      )
      .addTrace({
        from: CONTRACT_ADDRESSES[1],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [118, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[1],
        [],
        web3.eth.abi.encodeParameter("uint128", 90)
      );

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([
      createFinding(CONTRACT_ADDRESSES[0]),
      createFinding(CONTRACT_ADDRESSES[1]),
    ]);
  });

  it("should returns only findings from the Oracles with big deviations on new prices", async () => {
    handleTransaction = provideBigQueuedPriceDeviationHandler(
      CONTRACT_ADDRESSES
    );

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addTrace({
        from: CONTRACT_ADDRESSES[0],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [108, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[0],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      )
      .addTrace({
        from: CONTRACT_ADDRESSES[1],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [118, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[1],
        [],
        web3.eth.abi.encodeParameter("uint128", 90)
      )
      .addTrace({
        from: CONTRACT_ADDRESSES[2],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [105, true]),
      })
      .addEventLog(
        "LogValue(bytes32)",
        CONTRACT_ADDRESSES[2],
        [],
        web3.eth.abi.encodeParameter("uint128", 100)
      )
      .addTrace({
        from: CONTRACT_ADDRESSES[3],
        input: PEEK_FUNCTION_SELECTOR,
        output: web3.eth.abi.encodeParameters(["uint128", "bool"], [101, false]),
      });

    const findings: Finding[] = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([
      createFinding(CONTRACT_ADDRESSES[0]),
      createFinding(CONTRACT_ADDRESSES[1]),
    ]);
  });
});