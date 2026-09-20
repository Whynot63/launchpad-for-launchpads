// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {ILaunchpadFactory} from "../src/interfaces/ILaunchpadFactory.sol";
import {FeeHook} from "../src/hooks/FeeHook.sol";

contract DeployFeeHook is Script {
    uint160 constant FLAGS = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG;

    error HookAddressMismatch(address expected, address deployed);

    function run() external returns (FeeHook hook) {
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        LaunchpadFactory factory = LaunchpadFactory(vm.envAddress("FACTORY"));
        bytes memory constructorArgs = abi.encode(poolManager, factory);
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, FLAGS, type(FeeHook).creationCode, constructorArgs);

        vm.startBroadcast();
        hook = new FeeHook{salt: salt}(poolManager, ILaunchpadFactory(address(factory)));
        if (address(hook) != expected) revert HookAddressMismatch(expected, address(hook));
        factory.setHookAllowed(IHooks(address(hook)), true);
        vm.stopBroadcast();
    }
}
