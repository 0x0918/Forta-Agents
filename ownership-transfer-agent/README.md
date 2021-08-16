## Ownership Transfer

### Overview

This agent report when the OwnerTransferred event is emitted and the `from` address is a non zero address.

## Installation

```
npm install
```

## Run

Before run the agent to see how it works with real data, specify the `JSON-RPC` provider in the `forta.config.json` file. Uncomment the `jsonRpcUrl` property and set it to a websocket provider (e.g. `wss://mainnet.infura.io/ws/v3/`). Then you can run the agent using the following command:
```
npm start
```

## Test

```
npm test
```