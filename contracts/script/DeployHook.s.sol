// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {NoopHook} from "../src/hooks/NoopHook.sol";

contract DeployHook is Script {
    error HookAddressMismatch(address expected, address deployed);

    function run() external returns (NoopHook hook) {
        LaunchpadFactory factory = LaunchpadFactory(vm.envAddress("FACTORY"));
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, Hooks.BEFORE_INITIALIZE_FLAG, type(NoopHook).creationCode, "");

        vm.startBroadcast();
        hook = new NoopHook{salt: salt}();
        if (address(hook) != expected) revert HookAddressMismatch(expected, address(hook));
        factory.setHookAllowed(IHooks(address(hook)), true);
        vm.stopBroadcast();
    }
}
