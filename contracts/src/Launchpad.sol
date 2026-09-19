// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SafeCallback} from "@uniswap/v4-periphery/src/base/SafeCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {StdPrecompiles} from "base-std/StdPrecompiles.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {IB20Factory} from "base-std/interfaces/IB20Factory.sol";
import {B20FactoryLib} from "base-std/lib/B20FactoryLib.sol";
import {ILaunchpad} from "./interfaces/ILaunchpad.sol";
import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";

contract Launchpad is ILaunchpad, SafeCallback, Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint8 public constant TOKEN_DECIMALS = 18;

    ILaunchpadFactory public factory;
    Config public config;
    uint256 public launchCount;
    mapping(Currency => bool) public isQuoteEnabled;

    constructor(IPoolManager poolManager_) SafeCallback(poolManager_) {
        _disableInitializers();
    }

    function initialize(address owner_, Config calldata config_, Currency[] calldata quoteTokens) external initializer {
        __Ownable_init(owner_);
        factory = ILaunchpadFactory(msg.sender);
        _setConfig(config_);
        for (uint256 i = 0; i < quoteTokens.length; i++) {
            _setQuoteEnabled(quoteTokens[i], true);
        }
    }

    function setConfig(Config calldata config_) external onlyOwner {
        _setConfig(config_);
    }

    function setQuoteEnabled(Currency quoteToken, bool enabled) external onlyOwner {
        _setQuoteEnabled(quoteToken, enabled);
    }

    function launchToken(string calldata name, string calldata symbol, Currency quoteToken, IHooks hooks)
        external
        returns (address token)
    {
        if (!factory.isHookAllowed(hooks)) revert HookNotAllowed();
        if (!isQuoteEnabled[quoteToken]) revert QuoteNotEnabled();

        bytes[] memory mintSupplyToLaunchpad = new bytes[](1);
        mintSupplyToLaunchpad[0] = abi.encodeCall(IB20.mint, (address(this), config.totalSupply));

        token = StdPrecompiles.B20_FACTORY
            .createB20(
                IB20Factory.B20Variant.ASSET,
                bytes32(launchCount++),
                B20FactoryLib.encodeAssetCreateParams(name, symbol, address(0), TOKEN_DECIMALS),
                mintSupplyToLaunchpad
            );

        bool tokenIsCurrency1 = Currency.unwrap(quoteToken) < token;
        PoolKey memory poolKey = PoolKey({
            currency0: tokenIsCurrency1 ? quoteToken : Currency.wrap(token),
            currency1: tokenIsCurrency1 ? Currency.wrap(token) : quoteToken,
            fee: config.poolFee,
            tickSpacing: config.tickSpacing,
            hooks: hooks
        });
        int24 poolStartingTick = tokenIsCurrency1 ? _startingTick(quoteToken) : -_startingTick(quoteToken);

        poolManager.initialize(poolKey, TickMath.getSqrtPriceAtTick(poolStartingTick));
        poolManager.unlock(abi.encode(poolKey, tokenIsCurrency1, poolStartingTick));

        emit TokenLaunched(token, msg.sender, PoolIdLibrary.toId(poolKey), quoteToken, hooks, name, symbol);
    }

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != factory.owner()) revert NotFactoryOwner();
    }

    function _setConfig(Config calldata config_) internal {
        config = config_;
        emit ConfigSet(config_);
    }

    function _setQuoteEnabled(Currency quoteToken, bool enabled) internal {
        if (enabled) factory.quotePrice(quoteToken, 1e18);
        isQuoteEnabled[quoteToken] = enabled;
        emit QuoteEnabledSet(quoteToken, enabled);
    }

    function _startingTick(Currency quoteToken) internal view returns (int24) {
        uint256 initialMarketcapInQuote =
            FullMath.mulDiv(config.initialMarketcap, 1e18, factory.quotePrice(quoteToken, 1e18));
        uint160 sqrtTokensPerQuoteX96 =
            SafeCast.toUint160(Math.sqrt(FullMath.mulDiv(config.totalSupply, 1 << 96, initialMarketcapInQuote)) << 48);
        return TickMath.getTickAtSqrtPrice(sqrtTokensPerQuoteX96) / config.tickSpacing * config.tickSpacing;
    }

    function _unlockCallback(bytes calldata data) internal override returns (bytes memory) {
        (PoolKey memory poolKey, bool tokenIsCurrency1, int24 poolStartingTick) =
            abi.decode(data, (PoolKey, bool, int24));

        (int24 tickLower, int24 tickUpper) = tokenIsCurrency1
            ? (TickMath.minUsableTick(poolKey.tickSpacing), poolStartingTick)
            : (poolStartingTick, TickMath.maxUsableTick(poolKey.tickSpacing));
        uint160 sqrtPriceLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        uint128 liquidity = tokenIsCurrency1
            ? LiquidityAmounts.getLiquidityForAmount1(sqrtPriceLower, sqrtPriceUpper, config.totalSupply)
            : LiquidityAmounts.getLiquidityForAmount0(sqrtPriceLower, sqrtPriceUpper, config.totalSupply);

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: int256(uint256(liquidity)), salt: bytes32(0)
            }),
            ""
        );

        Currency token = tokenIsCurrency1 ? poolKey.currency1 : poolKey.currency0;
        int128 tokenDelta = tokenIsCurrency1 ? delta.amount1() : delta.amount0();
        poolManager.sync(token);
        IB20(Currency.unwrap(token)).transfer(address(poolManager), uint256(uint128(-tokenDelta)));
        poolManager.settle();
        return "";
    }
}
