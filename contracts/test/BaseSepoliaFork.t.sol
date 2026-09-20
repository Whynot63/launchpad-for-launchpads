// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {ILaunchpad} from "../src/interfaces/ILaunchpad.sol";
import {NoopHook} from "../src/hooks/NoopHook.sol";

contract BaseSepoliaForkTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint24 constant POOL_FEE = 0;
    int24 constant TICK_SPACING = 200;
    Currency constant ETH = Currency.wrap(address(0));
    IHooks constant NO_HOOKS = IHooks(address(0));

    IPoolManager poolManager;
    LaunchpadFactory factory;

    function setUp() public {
        string memory rpcUrl = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true);
        }
        vm.createSelectFork(rpcUrl);

        poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        factory = new LaunchpadFactory(address(this), address(new Launchpad(poolManager)));
        factory.setQuotePrice(ETH, 3000e18);
    }

    function launchpadWith(IHooks hooks) internal returns (Launchpad) {
        Currency[] memory quoteTokens = new Currency[](1);
        quoteTokens[0] = ETH;
        return Launchpad(
            factory.createLaunchpad(
                abi.encodeCall(
                    ILaunchpad.initialize,
                    (address(this), ILaunchpad.Config(TOTAL_SUPPLY, 5000e18, TICK_SPACING, hooks), quoteTokens, "")
                )
            )
        );
    }

    function assertLaunchesTokenInto(IHooks hooks) internal {
        IB20 token = IB20(launchpadWith(hooks).launchToken("Fork Token", "FORK", ETH));

        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        PoolKey memory poolKey = PoolKey(ETH, Currency.wrap(address(token)), POOL_FEE, TICK_SPACING, hooks);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
        assertGt(sqrtPriceX96, 0);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);
    }

    function test_launchesTokenWithoutHooksOnceFactoryAllowsIt() public {
        factory.setHookAllowed(NO_HOOKS, true);

        assertLaunchesTokenInto(NO_HOOKS);
    }

    function test_launchesTokenWithMinedNoopHook() public {
        (address expected, bytes32 salt) =
            HookMiner.find(address(this), Hooks.BEFORE_INITIALIZE_FLAG, type(NoopHook).creationCode, "");
        NoopHook hook = new NoopHook{salt: salt}();
        assertEq(address(hook), expected);
        factory.setHookAllowed(IHooks(address(hook)), true);

        assertLaunchesTokenInto(IHooks(address(hook)));
    }
}
