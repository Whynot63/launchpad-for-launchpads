// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";

contract DeployFactory is Script {
    function run() external returns (LaunchpadFactory factory) {
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        vm.startBroadcast();
        factory = new LaunchpadFactory(msg.sender, address(new Launchpad(poolManager)));
        vm.stopBroadcast();
    }
}
