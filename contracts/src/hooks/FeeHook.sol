// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary,
    toBeforeSwapDelta
} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {SafeCallback} from "@uniswap/v4-periphery/src/base/SafeCallback.sol";
import {ILaunchpad} from "../interfaces/ILaunchpad.sol";
import {ILaunchpadFactory} from "../interfaces/ILaunchpadFactory.sol";
import {IOwnable} from "../interfaces/IOwnable.sol";

contract FeeHook is SafeCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeCast for uint256;

    struct LaunchedPool {
        address launchpad;
        address creator;
        bool quoteIsCurrency0;
    }

    struct LaunchpadFees {
        bool isSetUp;
        uint16 launchpadFeeBps;
        uint16 creatorFeeBps;
    }

    uint256 internal constant BPS = 10_000;
    uint16 public constant MAX_LAUNCHPAD_FEES_BPS = 1000;

    ILaunchpadFactory public immutable factory;

    mapping(PoolId => LaunchedPool) public launchedPools;
    mapping(address => LaunchpadFees) public launchpadFees;
    mapping(address => mapping(Currency => uint256)) public collectableFees;

    event LaunchpadFeesSetUp(address indexed launchpad, uint16 launchpadFeeBps, uint16 creatorFeeBps);
    event FeesTaken(
        PoolId indexed poolId, Currency currency, uint256 protocolFee, uint256 launchpadFee, uint256 creatorFee
    );
    event FeesCollected(address indexed account, Currency indexed currency, address to, uint256 amount);

    error NotLaunchpad();
    error NotFeeRecipient();
    error FeesAlreadySetUp();
    error LaunchpadFeesTooHigh();

    constructor(IPoolManager poolManager_, ILaunchpadFactory factory_) SafeCallback(poolManager_) {
        factory = factory_;
    }

    function setupHookFee(uint16 launchpadFeeBps, uint16 creatorFeeBps) external {
        if (!factory.isLaunchpad(msg.sender)) revert NotLaunchpad();
        if (launchpadFees[msg.sender].isSetUp) revert FeesAlreadySetUp();
        if (launchpadFeeBps + creatorFeeBps > MAX_LAUNCHPAD_FEES_BPS) revert LaunchpadFeesTooHigh();
        launchpadFees[msg.sender] = LaunchpadFees(true, launchpadFeeBps, creatorFeeBps);
        emit LaunchpadFeesSetUp(msg.sender, launchpadFeeBps, creatorFeeBps);
    }

    function collectFees(address account, Currency currency, address to) external returns (uint256 amount) {
        if (!_canCollectFor(account)) revert NotFeeRecipient();
        amount = collectableFees[account][currency];
        collectableFees[account][currency] = 0;
        poolManager.unlock(abi.encode(currency, to, amount));
        emit FeesCollected(account, currency, to, amount);
    }

    function beforeInitialize(address sender, PoolKey calldata key, uint160) external onlyPoolManager returns (bytes4) {
        if (!factory.isLaunchpad(sender)) revert NotLaunchpad();
        (address token, address creator) = ILaunchpad(sender).currentLaunch();
        launchedPools[key.toId()] = LaunchedPool({
            launchpad: sender, creator: creator, quoteIsCurrency0: Currency.unwrap(key.currency1) == token
        });
        return IHooks.beforeInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        LaunchedPool memory pool = launchedPools[key.toId()];
        if (!_quoteIsSpecified(pool, params)) {
            return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint256 specifiedAmount =
            params.amountSpecified < 0 ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);
        uint256 fee = _takeFees(key, pool, specifiedAmount);
        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(fee.toInt128(), 0), 0);
    }

    function afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, int128)
    {
        LaunchedPool memory pool = launchedPools[key.toId()];
        if (_quoteIsSpecified(pool, params)) return (IHooks.afterSwap.selector, 0);

        int128 quoteDelta = pool.quoteIsCurrency0 ? delta.amount0() : delta.amount1();
        uint256 fee = _takeFees(key, pool, uint256(uint128(quoteDelta < 0 ? -quoteDelta : quoteDelta)));
        return (IHooks.afterSwap.selector, fee.toInt128());
    }

    function _unlockCallback(bytes calldata data) internal override returns (bytes memory) {
        (Currency currency, address to, uint256 amount) = abi.decode(data, (Currency, address, uint256));
        poolManager.burn(address(this), currency.toId(), amount);
        poolManager.take(currency, to, amount);
        return "";
    }

    function _quoteIsSpecified(LaunchedPool memory pool, SwapParams calldata params) internal pure returns (bool) {
        bool quoteIsInput = params.zeroForOne == pool.quoteIsCurrency0;
        bool isExactInput = params.amountSpecified < 0;
        return quoteIsInput == isExactInput;
    }

    function _takeFees(PoolKey calldata key, LaunchedPool memory pool, uint256 quoteAmount)
        internal
        returns (uint256 fee)
    {
        LaunchpadFees memory fees = launchpadFees[pool.launchpad];
        uint256 protocolFeeBps = factory.protocolFeeBps();
        uint256 totalFeeBps = protocolFeeBps + fees.launchpadFeeBps + fees.creatorFeeBps;
        fee = quoteAmount * totalFeeBps / BPS;
        if (fee == 0) return 0;

        Currency quote = pool.quoteIsCurrency0 ? key.currency0 : key.currency1;
        poolManager.mint(address(this), quote.toId(), fee);

        uint256 protocolFee = fee * protocolFeeBps / totalFeeBps;
        uint256 launchpadFee = fee * fees.launchpadFeeBps / totalFeeBps;
        uint256 creatorFee = fee - protocolFee - launchpadFee;
        collectableFees[address(factory)][quote] += protocolFee;
        collectableFees[pool.launchpad][quote] += launchpadFee;
        collectableFees[pool.creator][quote] += creatorFee;
        emit FeesTaken(key.toId(), quote, protocolFee, launchpadFee, creatorFee);
    }

    function _canCollectFor(address account) internal view returns (bool) {
        if (account == msg.sender) return true;
        if (account == address(factory)) return msg.sender == factory.owner();
        return factory.isLaunchpad(account) && msg.sender == IOwnable(account).owner();
    }
}
