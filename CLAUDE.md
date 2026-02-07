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
