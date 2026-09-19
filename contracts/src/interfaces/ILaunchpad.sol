// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ILaunchpadFactory} from "./ILaunchpadFactory.sol";

interface ILaunchpad {
    struct Config {
        uint256 totalSupply;
        uint256 initialMarketcap;
        uint24 poolFee;
        int24 tickSpacing;
    }

    event TokenLaunched(
        address indexed token,
        address indexed creator,
        PoolId indexed poolId,
        Currency quoteToken,
        IHooks hooks,
        string name,
        string symbol
    );
    event ConfigSet(Config config);
    event QuoteEnabledSet(Currency indexed quoteToken, bool enabled);

    error NotFactoryOwner();
    error HookNotAllowed();
    error QuoteNotEnabled();

    function initialize(address owner_, Config calldata config_, Currency[] calldata quoteTokens) external;

    function setConfig(Config calldata config_) external;

    function setQuoteEnabled(Currency quoteToken, bool enabled) external;

    function launchToken(string calldata name, string calldata symbol, Currency quoteToken, IHooks hooks)
        external
        returns (address token);

    function factory() external view returns (ILaunchpadFactory);

    function config()
        external
        view
        returns (uint256 totalSupply, uint256 initialMarketcap, uint24 poolFee, int24 tickSpacing);

    function launchCount() external view returns (uint256);

    function isQuoteEnabled(Currency quoteToken) external view returns (bool);
}
