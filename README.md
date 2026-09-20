# Launchpad of Launchpads

## Contracts

Deployed on Base Sepolia.

| Contract | Address | Source |
|---|---|---|
| `LaunchpadFactory` | [`0x70207718Aa760f04719973314E662BD3719cff1B`](https://sepolia.basescan.org/address/0x70207718Aa760f04719973314E662BD3719cff1B) | [contracts/src/LaunchpadFactory.sol](contracts/src/LaunchpadFactory.sol) |
| `Launchpad (implementation)` | [`0xfB326631df519Ce2D1af78fe1FFCC949b47E89ca`](https://sepolia.basescan.org/address/0xfB326631df519Ce2D1af78fe1FFCC949b47E89ca) | [contracts/src/Launchpad.sol](contracts/src/Launchpad.sol) |
| `FeeHook` | [`0xAdd49fE69D02Aa294eAA84bA302B2d16aBA960cc`](https://sepolia.basescan.org/address/0xAdd49fE69D02Aa294eAA84bA302B2d16aBA960cc) | [contracts/src/hooks/FeeHook.sol](contracts/src/hooks/FeeHook.sol) |
| `NoopHook` | [`0xaf223ad59BbC4FAFCCAE468692417bD6C9546000`](https://sepolia.basescan.org/address/0xaf223ad59BbC4FAFCCAE468692417bD6C9546000) | [contracts/src/hooks/NoopHook.sol](contracts/src/hooks/NoopHook.sol) |

## Thoughts and decisions

### Product: power-law distribution of launchpads

Token launches follow a power law: a huge number of tokens get launched, but only a few percent survive. I assume launchpads will behave the same way — many will be created, but real volume will come from a handful of the most successful ones.

This leads to two design goals that pull in opposite directions:

1. **Zero friction at the start.** Creating a launchpad should take two clicks — as easy as launching a token. Most launchpads will die, so the cost of creating one (for the user and for us) must be close to zero, and we want as many attempts as possible to find the winners.
2. **Full customization for the winners.** The few launchpads that generate real volume are the business. The main risk is losing them: once a launchpad is big enough, it is tempted to fork the contracts and leave. They must be able to customize everything, so that staying on our infrastructure remains the best option for as long as possible.


### Technical architecture: monorepo

For simplicity of development, everything lives in a monorepo: it is convenient to deploy, and an LLM gets access to the whole context at once. The repo has a folder for smart contracts, a folder for each of the two web apps, a folder for the indexer, and a folder for the price updater.

Components:

- `contracts` — base-foundry (for working with B20 tokens)
- `launchpad-factory-app` — the frontend for creating and managing launchpads. Next.js + wagmi/viem; the backend lives here too (route handlers), no separate backend service
- `launchpad-app` — the frontend of a launchpad itself; a separate service that works independently from `launchpad-factory-app`. Same stack: Next.js + wagmi/viem
- `indexer` — [Envio](https://envio.dev/)
- `price-updater` — a cron microservice: every 10 minutes it takes the ETH price from Binance, compares it with the price stored in the factory contract, and pushes a new price on-chain if it moved by more than ±5%

### Contracts

- **Factory with a contract per launchpad.** A factory deploys a separate smart contract for each launchpad. This encapsulates the logic of each launchpad and makes it possible to upgrade features for each launchpad independently.
- **Token launch via one-sided liquidity, without an explicit migration.** If needed, a migration can be simulated on the frontend. Without a migration, tokens are immediately visible in all bots and trading apps, because they go straight into Uniswap — unlike the bonding curve approach.
- **A launchpad is a proxy.** Each launchpad is deployed as an upgradeable proxy, so that big launchpads can ship their own upgrades in the future. It costs us nothing, but adds flexibility.

1. There is a launchpad factory. The factory itself is not upgradeable (not a proxy); its owner manages the launchpad implementation, the hook whitelist, the protocol fee, and the list of price updaters. Quote prices are set by the price updaters (the owner can set them too).
2. Anyone can launch a launchpad. A launchpad is created as a proxy, and its implementation is controlled by the factory owner.
3. Only the factory owner can change the implementation of a launchpad.
4. A launchpad allows launching a token against a whitelisted quote token and with a whitelisted hook.
5. The launch parameters (total supply, initial market cap in USD, tick spacing, enabled quote tokens, and the hook — picked from the factory whitelist) are chosen by the launchpad owner; users always launch with the hook the owner picked. The starting price is derived from the market cap using the factory's quote price.
6. Hooks are whitelisted at the factory level: because of possible hook scams, users must not be able to write their own hooks without approval.

### Fees

Fees are collected by a Uniswap v4 hook (`FeeHook`), not by the pool: the pool's own LP fee is zero. On every swap the hook takes a fee in the quote token and splits it into three buckets:

- **The platform (the factory).** Only we can change our fee: the factory owner sets it, and it applies to all pools at once, including already launched tokens.
- **The launchpad.** The launchpad sets its own fee when it is created.
- **The token creator.** The creator's fee is also set by the launchpad when it is created.

How it works:

- The launchpad's fee and the creator's fee are stored inside the hook, per launchpad. When a launchpad is created, it makes a call to its hook (`setupHookFee`) with these two numbers. The call can be made only once, so the fees are fixed at creation.
- The fee is always taken in the quote token, for buys and sells, for exact-input and exact-output swaps.
- The hook attributes each pool to the launchpad that created it and to the creator who launched the token, so the fee from every trade lands in the right buckets.
- Each party claims its own bucket: the factory owner, the launchpad owner, and the token creator.

A different form of fees can be shipped by publishing a new hook: a new hook can use a different formula. We whitelist it in the factory, and launchpads can pick it.

### Indexer

We deliberately do not index whitelisted quote tokens and hooks: they will be added so rarely that it is easier for us to keep them as a config in the repository.

### Frontend

Screens of `launchpad-factory-app`:

- Create a launchpad
- Edit a launchpad
- List of launched launchpads
- Launchpad statistics, with a button for the launchpad owner to claim the launchpad's fees

Screens of `launchpad-app`:

- List of tokens
- Token page, with a buy / sell widget and a button for the token creator to claim creator fees
- Launch a token

### Security

Right now there are two roles in the project: the factory owner and the price updater.

- **Factory owner.** The owner can do really dangerous things, so it must be a multisig.
- **Price updater.** It does not affect anything critical: the worst it can do is temporarily break the UX of new launches. So it can be kept as a plain private key. The real price should be double-checked by a second service, both as a healthcheck and as a check that the updater works correctly.

What each party can and cannot do:

- **Factory owner** can upgrade the implementation of any launchpad, change the implementation used for new launchpads, whitelist hooks, set the protocol fee (capped at 5%), and manage price updaters. The upgrade right is the dangerous one: every launchpad holds the liquidity positions of all tokens launched through it, so a malicious upgrade could pull that liquidity.
- **Launchpad owner** can change the launch config for future launches, enable or disable quote tokens, and claim the launchpad's fees. The owner cannot upgrade the launchpad, cannot whitelist hooks, and cannot touch already launched tokens or their liquidity.
- **Price updater** can only set quote prices. A price affects only the starting price of new launches, never existing pools.
- **Users** can only launch tokens with the hook and the parameters the launchpad owner picked; they cannot pass their own hook.

Guarantees built into the contracts:

- **Tokens have no admin.** Every B20 token is created without an admin and without roles: nobody, including us, can mint more, pause transfers, or seize balances. The supply is fixed and minted once.
- **Liquidity is locked.** The whole supply goes into the pool as a one-sided position owned by the launchpad contract, and the launchpad has no function to withdraw it. This holds as long as the implementation is not upgraded.
- **Hooks are whitelisted** at the factory level (see Contracts, point 6).
- **The fee hook trusts only real launchpads.** It accepts a pool only if it is initialized by a launchpad registered in the factory, and it accepts a fee setup only from a registered launchpad and only once. The launchpad and creator fees are capped at 10% together. Fees accrue inside the Uniswap v4 PoolManager, and each bucket can be collected only by its owner.
- **A launchpad is created atomically.** The factory deploys the proxy, registers it, and initializes it in a single transaction, and reverts if the launchpad did not end up initialized by this factory.

Known limitations:

- The factory owner's upgrade right is the main trust assumption of the system.
- The upload endpoint has no authentication and no rate limit.
- Quote prices come from a single source (Binance) through the price updater, not from an onchain oracle.
- The contracts are not audited.

### What's next: launchpad product

- Build a feed for token discovery (trending, biggest, newest, and so on).
- Build a portfolio for traders: show which tokens they bought and which tokens they created.
- Improve the token page: a chart, maybe a chat, and extra statistics like on DEX Screener.

### What's next: product for launchpad creators

- Ship other hooks (for example, a hook that reinvests all fees into the launchpad's own token).
- Add more ways to customize a launchpad (background, fonts, widgets, setup Google Analytics tag / Facebook pixel for analytics, and so on).
- Add an admin panel that shows all launched launchpads and their statistics.
- Let launchpad creators connect their own domains: give them an instruction on how to set a CNAME DNS record.
