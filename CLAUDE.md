# GhostFlow

## Project Overview

**GhostFlow** is a human-readable Ethereum transaction analysis tool.

- **Input**: Transaction hash
- **Output**: Labeled, semantically-grouped token flow visualization

## Core Concept

GhostFlow parses ERC-20 token transfers from Ethereum transactions and presents them in a meaningful way.

### The Problem

Tools like Etherscan show raw token transfers as flat lists:
```
From → To → Amount
```

This makes complex DeFi transactions difficult to understand (see `docs/image.png` for an example showing 21 unorganized transfers).

### The Solution

GhostFlow groups and labels transfers by their semantic meaning, turning raw data into understandable DeFi operations.

## Context7 library IDs
- Vitest: /antfu/vitest
- Ethers.js: ...

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite (TypeScript)
- **Backend**: Node.js + Fastify (TypeScript)
- **Shared**: Common types and utilities package

## Planned Features

### Protocol Support

- **Aave**: Supply, borrow, repay, withdraw, liquidation
- **Uniswap**: Swaps, add/remove liquidity
- **ERC20**: Mints (from `0x0`) and burns (to `0x0`)
- **ERC4626**: Vault deposits and redemptions

## Development Rules

- **Package Manager**: pnpm (required)
- Always use Context7 MCP when I need library/API documentation (except for Moralis!), code generation, setup or configuration steps without me having to explicitly ask.
- Create maintainable code that follows the best practices and design patterns, including creational (singleton, factory, abstract factory, builders), behavioural and structural patterns. But do not over-engineer! Keep a good balance between simplicity, readability and maintainability

# Protocol integration

### Aave V3
Tips for decoding Aave supply: You have to call Aave Pool's "supply" function.
The Pool address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2". Find the ABI under "Aave-poolV3-abi.json". The underlying tokens are transferred to the a-token contract (like aEthweEth), not the Pool!

The following Aave operations are recognized and attributed, and displayed
in a unique way, rather than individual transfers:

1. Supply collateral
2. Withdraw collateral
3. Borrow
4. Repay

### Uniswap V3
We parse Uniswap V3 swaps and display them as a defi operation. There are a few cases to consider:

- Single swaps directly between a Uniswap V3 pool and a user. The pool will first transfer tokens to the user, and then trigger the UniswapV3Callback on the caller, and expect tokens in return. In this case these is always transfer pool->user and possibly more than one user->pool transfers. Uni V3 pools are non-payable, meaning they can't have native ETH as one of the tokens, so there are no ETH edge cases to handle.
- Single swaps via one of the basic routers: SwapRouter, SwapRouter02. Check out deployments: https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments. In this case there are ALWAYS two swaps: pool->user followed by user->pool. Keep in mind that there are no transfers with the router itself.
- Single swap using Universal Router: in this case there are multiple swaps: (1) Uni V3 pool -> Universal Router (2) user -> Uni V3 pool 
- In case of routers, there are ETH edge cases, when a router can wrap or unwrap WETH, so there will be an extra transfer between the router and WETH contract. The native Eth transfers that are associated with these operations are identified and included in the final swap display, meaning they won't be shown as standalone ETH transfers.
- 

### Uniswap V2
- Single swap using Universal Router. In this case only two transfers: (1) user -> Uni V2 pool. (2) Uni V2 pool -> user. So the transfer pattern looks the same as swapping through the pool directly.

### Uniswap V4
`PoolManager`, Universal Router.
- Single swap using Universal Router. In this case only two transfers: (1) Pool Manager -> user (2) user -> Pool Manager. So the transfer pattern looks the same as swapping through the pool manager directly.
