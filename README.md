# Bluefin Exchange Contracts - EVM

Solidity smart contracts for Bluefin Protocol. Currently used on [Bluefin Exchange](https://trade.bluefin.io)

## **Overview**

The smart contracts enable a non-custodial protocol for trading leveraged perpetual swaps without requiring any central entity. The isolated margining framework allows traders to manage the risk on positions by allocating collateral individually to each leveraged position. The contracts provide traders the ability to trade with one another with isolated margin and allow liquidators to liquidate under-collateralized positions. In isolated margining, the margin assigned to a position represents the maximal possible loss on a position. When unrealized losses reduce the margin ratio to be lower than the maintenance margin ratio, the position is liquidated.

Full Documentation at [https://learn.bluefin.io/arbitrum/](https://learn.bluefin.io/arbitrum/)

### Usage:
- Ensure you are using Node 18.x.x
- Copy content of `.env.example` file create a `.env` file
- Update submodules by running `yarn update:submodules`
- Install packages:
    - Run `yarn` on main directory
    - cd submodules/library 
    - Run `yarn` and `yarn build`
    - And return back to main directory `cd ../../`
- Compile contracts using `yarn build`
- To run unit tests, ensure to set `DEPLOY_ON` flag  to `hardhat` and run `yarn test`
- Create deployment config file at path "./bluefin-exchange-contracts-evm/deploymentConfig.json". An example is provided in "deploymentConfigExample.json"
- To deploy contracts run `yarn deploy`
- To print size of contracts run `yarn size`

## Design

<to insert image>

### Evaluator.sol
The contract stores different configuration variables for the market. It also has functions to evaluate trade parameters and values to ensure that trades are allowed and are within the required boundaries.
    
### Perpetual.sol
The contract is responsible for storing the position balances of each user for the market. For each perpetual market, a separate instance of the perpetual contract is deployed. 

Each Perpetual contract is whitelisted as BANK_OPERATOR on the MarginBank contract, allowing it to move funds from any account address in MarginBank without the account’s permission. 

Traders and Liquidators invoke trade() method on perpetual contracts to either perform a new trade, liquidate a position or auto-deleverage positions. The contract internally directs the call to the Traders contract, which at the moment are Orders, Liquidation and ADL, that apply the Isolated Margining logic on the trade and return the output to the Perpetual contract. 

Perpetual, at the end of the trade, transfers funds from either Perpetual to the trader account in the MarginBank or from the trader’s account to Perpetual. Perpetual also transfers the fee to FEE_POOL in the MarginBank and performs undercollateralized checks on all the traders. This is done by updating values in the MarginBank rather than actually transferring USDC between contracts.

Please note that:
1. Only whitelisted Off-chain settlement operators can perform normal trades
1. Only whitelisted Off-chain deleveraging operator can perform ADL trades

### MarginBank.sol
The bank is responsible for storing all addresses collateral, i.e. USDC tokens. It stores the USDC balance of each perpetual market, which is increased or decreased whenever a new position on them is opened or closed, the FEE_POOL, and insurance fund pool balances. Users must first lock their tokens into the MarginBank before they can perform trades in any Perpetual market.
    
### FundingOracle.sol
The contract is responsible for recording trades that participate in the computation of the hourly funding rate. The trades can only be recorded by the perpetual contract. 

The contract exposes the method setFundingRate() that can only be invoked by the Perpetual contract of the market. The Perpetual contract exposes the setFundingRate() method, which can be invoked by anyone and it internally invokes FundingOracle.setFundingRate(). 

The guardian can toggle the off-chain funding rate switch at any moment, allowing only a whitelisted operator to set the funding rate for every window once per hour. 

### Guardian.sol
The contract contains a whitelisted operator address which is the guardian. The guardian has been given certain privileges that can be used to prevent or reduce any financial loss in case of any hack or security vulnerability. These privileges include:
- Turning off/on trades
- Turning off/on withdrawal from the bank
- Turning off/on on-chain funding rate computation and starting/stopping off-chain computation

### IsolatedTrader.sol
The contract is responsible for applying Isolated Margin logic to the trades to be executed and also for the cancellation of orders. The contract implements the ITrader interface, which exposes the trade() method, which only whitelisted Perpetual contracts can invoke. 

The inputs to the trade() call are two accounts and their orders to be settled against one other. The returned response from the method back to Perpetual is the updated position balances of both accounts, the fee to be transferred to fee pool, funds flow amount either to MarginBank or from users account in MarginBank to itself) for both maker and taker account. 

### IsolatedLiquidator.sol
The contract is responsible for performing liquidation trade computation. It's mainly similar to IsolatedTrader, except that the input to its trade() method is a single maker’s order, oracle price, and quantity of position the liquidator wants to liquidate. 

Note that there is no liquidator order; it's created using the maker order. The output is almost identical to Orders.trade() as well, with the exception that the fee is always returned as zero as there is no fee charged on the liquidation trade and the funds flow for the maker(liquidate) is always zero. Before returning data to Perpetual, the trade() method computes any premium amount on liquidation that is to be transferred to INSURANCE_POOL and asks the MarginBank to make a transfer to the pool from the liquidator’s address, which requires each liquidator contract to be whitelisted BANK_OPERATOR just like the Perpetual contract.
    
### IsolatedADL.sol
The contract is responsible for performing Auto De-leveraging trade computations. It’s mainly similar to IsolatedTrader and is triggered by a whitelisted operator when a position is under-collateralized and below bankruptcy price.
    
    
## License

[Apache-2.0](https://github.com/fireflyprotocol/bluefin-exchange-contracts-evm/blob/main/LICENSE)
