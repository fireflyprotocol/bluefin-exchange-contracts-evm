# Bluefin Exchange Contracts - EVM

Solidity smart contracts for Bluefin Protocol. Currently used on [Bluefin Exchange](https://trade.bluefin.io)

## **Overview**

The smart contracts enable a non-custodial protocol for trading leveraged perpetual swaps without requiring any central entity. The isolated margining framework allows traders to manage the risk on positions by allocating collateral individually to each leveraged position. The contracts provide traders the ability to trade with one another with isolated margin and allow liquidators to liquidate under-collateralized positions. In isolated margining, the margin assigned to a position represents the maximal possible loss on a position. When unrealized losses reduce the margin ratio to be lower than the maintenance margin ratio, the position is liquidated.

Full Documentation at [https://learn.bluefin.io/arbitrum/](https://learn.bluefin.io/arbitrum/)

### Usage:
- Ensure you are using Node 18.x.x
- Copy content of `.env.example` file create a `.env` file
- Update submodules by running `yarn update:submodules`
- Install packages using `yarn`
- Compile contracts using `yarn build`
- To run unit tests, ensure to set `DEPLOY_ON` flag  to `hardhat` and run `yarn test`
- Create deployment config file at path "./bluefin-exchange-contracts-evm/deploymentConfig.json". An example is provided in "deploymentConfigExample.json"
- To deploy contracts run `yarn deploy`
- To print size of contracts run `yarn size`

## License

[Apache-2.0](https://github.com/fireflyprotocol/bluefin-exchange-contracts-evm/blob/main/LICENSE)
