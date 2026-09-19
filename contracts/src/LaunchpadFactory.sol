// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {IOwnable} from "./interfaces/IOwnable.sol";

contract LaunchpadFactory is ILaunchpadFactory, Ownable {
    address public launchpadImplementation;
    mapping(IHooks => bool) public isHookAllowed;
    mapping(Currency => uint256) internal usdPricePerWad;

    event LaunchpadCreated(address indexed launchpad, address indexed creator);
    event LaunchpadImplementationSet(address indexed launchpadImplementation);
    event HookAllowedSet(IHooks indexed hooks, bool allowed);
    event QuotePriceSet(Currency indexed quoteToken, uint256 usdPricePerWad);

    error QuotePriceNotSet();

    constructor(address owner_, address launchpadImplementation_) Ownable(owner_) {
        _setLaunchpadImplementation(launchpadImplementation_);
    }

    function setLaunchpadImplementation(address launchpadImplementation_) external onlyOwner {
        _setLaunchpadImplementation(launchpadImplementation_);
    }

    function setHookAllowed(IHooks hooks, bool allowed) external onlyOwner {
        isHookAllowed[hooks] = allowed;
        emit HookAllowedSet(hooks, allowed);
    }

    function setQuotePrice(Currency quoteToken, uint256 usdPricePerWad_) external onlyOwner {
        usdPricePerWad[quoteToken] = usdPricePerWad_;
        emit QuotePriceSet(quoteToken, usdPricePerWad_);
    }

    function createLaunchpad(bytes calldata initializeCalldata) external returns (address launchpad) {
        launchpad = address(new ERC1967Proxy(launchpadImplementation, initializeCalldata));
        emit LaunchpadCreated(launchpad, msg.sender);
    }

    function quotePrice(Currency quoteToken, uint256 amount) external view returns (uint256) {
        uint256 price = usdPricePerWad[quoteToken];
        if (price == 0) revert QuotePriceNotSet();
        return FullMath.mulDiv(amount, price, 1e18);
    }

    function owner() public view override(IOwnable, Ownable) returns (address) {
        return super.owner();
    }

    function _setLaunchpadImplementation(address launchpadImplementation_) internal {
        launchpadImplementation = launchpadImplementation_;
        emit LaunchpadImplementationSet(launchpadImplementation_);
    }
}
