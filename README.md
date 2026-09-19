# Launchpad of Launchpads

## Thoughts and decisions

### Product: power-law distribution of launchpads

Token launches follow a power law: a huge number of tokens get launched, but only a few percent survive. I assume launchpads will behave the same way — many will be created, but real volume will come from a handful of the most successful ones.

This leads to two design goals that pull in opposite directions:

1. **Zero friction at the start.** Creating a launchpad should take two clicks — as easy as launching a token. Most launchpads will die, so the cost of creating one (for the user and for us) must be close to zero, and we want as many attempts as possible to find the winners.
2. **Full customization for the winners.** The few launchpads that generate real volume are the business. The main risk is losing them: once a launchpad is big enough, it is tempted to fork the contracts and leave. They must be able to customize everything, so that staying on XXX infrastructure remains the best option for as long as possible.


### Technical architecture: monorepo

For simplicity of development, everything lives in a monorepo: it is convenient to deploy, and an LLM gets access to the whole context at once. The repo has a folder for smart contracts, a folder for the web app, and a folder for the indexer.

Components:

- `contracts` — base-foundry (for working with B20 tokens)
- `web-app` — Next.js + wagmi/viem; the backend lives here too (route handlers), no separate backend service
- `indexer` — [Envio](https://envio.dev/)

### Contracts

- **Factory with a contract per launchpad.** A factory deploys a separate smart contract for each launchpad. This encapsulates the logic of each launchpad and makes it possible to upgrade features for each launchpad independently.
- **Token launch via one-sided liquidity, without an explicit migration.** If needed, a migration can be simulated on the frontend. Without a migration, tokens are immediately visible in all bots and trading apps, because they go straight into Uniswap — unlike the bonding curve approach.
- **A launchpad is a proxy.** Each launchpad is deployed as an upgradeable proxy, so that big launchpads can ship their own upgrades in the future. It costs us nothing, but adds flexibility.
