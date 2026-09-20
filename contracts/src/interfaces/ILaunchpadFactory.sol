// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IOwnable} from "./IOwnable.sol";

interface ILaunchpadFactory is IOwnable {
    function isLaunchpad(address launchpad) external view returns (bool);

    function protocolFeeBps() external view returns (uint16);

    function isHookAllowed(IHooks hooks) external view returns (bool);

    function quotePrice(Currency quoteToken, uint256 amount) external view returns (uint256);
}
