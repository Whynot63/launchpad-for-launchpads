// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {Launchpad} from "../src/Launchpad.sol";

contract BeforeInitializeHook {
    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }
}

contract LaunchpadV2 is Launchpad {
    constructor(IPoolManager poolManager_) Launchpad(poolManager_) {}

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract LaunchpadTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 constant TOTAL_SUPPLY = 1_000_000_000e18;
    int24 constant STARTING_TICK = 207200;
    uint24 constant POOL_FEE = 10000;
    int24 constant TICK_SPACING = 200;

    Currency constant ETH = Currency.wrap(address(0));
    Currency constant QUOTE_BELOW_B20 = Currency.wrap(0x1111111111111111111111111111111111111111);
    Currency constant QUOTE_ABOVE_B20 = Currency.wrap(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    IHooks constant NO_HOOKS = IHooks(address(0));
    IHooks constant HOOKS = IHooks(address(uint160(0x4444 << 144) | uint160(Hooks.BEFORE_INITIALIZE_FLAG)));

    IPoolManager poolManager;
    PoolSwapTest swapRouter;
    Launchpad launchpad;

    function setUp() public {
        poolManager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(poolManager);
        launchpad = Launchpad(
            address(
                new ERC1967Proxy(
                    address(new Launchpad(poolManager)),
                    abi.encodeCall(
                        Launchpad.initialize,
                        (address(this), Launchpad.Config(TOTAL_SUPPLY, POOL_FEE, TICK_SPACING), ETH, STARTING_TICK)
                    )
                )
            )
        );
        deployCodeTo("Launchpad.t.sol:BeforeInitializeHook", address(HOOKS));
        deployQuoteToken(QUOTE_BELOW_B20);
        deployQuoteToken(QUOTE_ABOVE_B20);
    }

    function deployQuoteToken(Currency quoteToken) internal {
        address quote = Currency.unwrap(quoteToken);
        deployCodeTo("MockERC20.sol:MockERC20", abi.encode("Quote", "QUOTE", uint8(18)), quote);
        MockERC20(quote).mint(address(this), 1000 ether);
        MockERC20(quote).approve(address(swapRouter), type(uint256).max);
    }

    function poolKeyOf(address token, Currency quoteToken, IHooks hooks) internal pure returns (PoolKey memory) {
        return Currency.unwrap(quoteToken) < token
            ? PoolKey(quoteToken, Currency.wrap(token), POOL_FEE, TICK_SPACING, hooks)
            : PoolKey(Currency.wrap(token), quoteToken, POOL_FEE, TICK_SPACING, hooks);
    }

    function buy(address token, Currency quoteToken, uint256 quoteAmount) internal {
        bool quoteIsCurrency0 = Currency.unwrap(quoteToken) < token;
        swapRouter.swap{value: quoteToken == ETH ? quoteAmount : 0}(
            poolKeyOf(token, quoteToken, NO_HOOKS),
            SwapParams(
                quoteIsCurrency0,
                -int256(quoteAmount),
                quoteIsCurrency0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            ),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
    }

    function test_launchToken_createsB20WithConfiguredSupply() public {
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS));

        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_launchToken_putsWholeSupplyIntoPoolAtStartingPrice() public {
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS));

        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolKeyOf(address(token), ETH, NO_HOOKS).toId());
        assertEq(sqrtPriceX96, TickMath.getSqrtPriceAtTick(STARTING_TICK));
        assertEq(tick, STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);
        assertEq(address(poolManager).balance, 0);
    }

    function test_launchToken_tokenIsBuyableWithEthRightAway() public {
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS));

        buy(address(token), ETH, 1 ether);

        assertGt(token.balanceOf(address(this)), 0);
        (, int24 tick,,) = poolManager.getSlot0(poolKeyOf(address(token), ETH, NO_HOOKS).toId());
        assertLt(tick, STARTING_TICK);
    }

    function test_launchToken_againstQuoteTokenSortedBelowToken() public {
        launchpad.setQuoteToken(QUOTE_BELOW_B20, true, STARTING_TICK);

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", QUOTE_BELOW_B20, NO_HOOKS));

        PoolId poolId = poolKeyOf(address(token), QUOTE_BELOW_B20, NO_HOOKS).toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        assertEq(tick, STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);

        buy(address(token), QUOTE_BELOW_B20, 1 ether);
        assertGt(token.balanceOf(address(this)), 0);
    }

    function test_launchToken_againstQuoteTokenSortedAboveTokenMirrorsThePrice() public {
        launchpad.setQuoteToken(QUOTE_ABOVE_B20, true, STARTING_TICK);

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", QUOTE_ABOVE_B20, NO_HOOKS));

        PoolId poolId = poolKeyOf(address(token), QUOTE_ABOVE_B20, NO_HOOKS).toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        assertEq(tick, -STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);

        buy(address(token), QUOTE_ABOVE_B20, 1 ether);
        assertGt(token.balanceOf(address(this)), 0);
        (, tick,,) = poolManager.getSlot0(poolId);
        assertGt(tick, -STARTING_TICK);
    }

    function test_launchToken_sameQuoteAmountBuysSameTokenAmountInBothSortOrders() public {
        launchpad.setQuoteToken(QUOTE_BELOW_B20, true, STARTING_TICK);
        launchpad.setQuoteToken(QUOTE_ABOVE_B20, true, STARTING_TICK);
        IB20 tokenAboveQuote = IB20(launchpad.launchToken("A", "A", QUOTE_BELOW_B20, NO_HOOKS));
        IB20 tokenBelowQuote = IB20(launchpad.launchToken("B", "B", QUOTE_ABOVE_B20, NO_HOOKS));

        buy(address(tokenAboveQuote), QUOTE_BELOW_B20, 1 ether);
        buy(address(tokenBelowQuote), QUOTE_ABOVE_B20, 1 ether);

        assertApproxEqRel(tokenAboveQuote.balanceOf(address(this)), tokenBelowQuote.balanceOf(address(this)), 1e12);
    }

    function testFuzz_launchToken_succeedsForAnyStartingTickInBothSortOrders(int24 startingTick) public {
        startingTick = int24(bound(startingTick, -1000, 1000)) * TICK_SPACING;
        launchpad.setQuoteToken(QUOTE_BELOW_B20, true, startingTick);
        launchpad.setQuoteToken(QUOTE_ABOVE_B20, true, startingTick);

        launchpad.launchToken("A", "A", QUOTE_BELOW_B20, NO_HOOKS);
        launchpad.launchToken("B", "B", QUOTE_ABOVE_B20, NO_HOOKS);
    }

    function test_launchToken_revertsWhenQuoteTokenNotAllowed() public {
        vm.expectRevert(Launchpad.QuoteTokenNotAllowed.selector);
        launchpad.launchToken("Test Token", "TEST", QUOTE_BELOW_B20, NO_HOOKS);
    }

    function test_launchToken_revertsWhenQuoteTokenWasDisallowed() public {
        launchpad.setQuoteToken(ETH, false, STARTING_TICK);

        vm.expectRevert(Launchpad.QuoteTokenNotAllowed.selector);
        launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS);
    }

    function test_setQuoteToken_revertsWhenCallerIsNotOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Launchpad.NotOwner.selector);
        launchpad.setQuoteToken(QUOTE_BELOW_B20, true, STARTING_TICK);
    }

    function test_setQuoteToken_revertsWhenStartingTickNotAlignedToTickSpacing() public {
        vm.expectRevert(Launchpad.StartingTickNotAlignedToTickSpacing.selector);
        launchpad.setQuoteToken(QUOTE_BELOW_B20, true, STARTING_TICK + 1);
    }

    function test_launchToken_eachLaunchGetsItsOwnToken() public {
        address first = launchpad.launchToken("Same", "SAME", ETH, NO_HOOKS);
        address second = launchpad.launchToken("Same", "SAME", ETH, NO_HOOKS);

        assertTrue(first != second);
    }

    function test_launchToken_withAllowedHooksCreatesPoolWithThoseHooks() public {
        launchpad.setHookAllowed(HOOKS, true);

        address token = launchpad.launchToken("Hooked", "HOOK", ETH, HOOKS);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKeyOf(token, ETH, HOOKS).toId());
        assertEq(sqrtPriceX96, TickMath.getSqrtPriceAtTick(STARTING_TICK));
    }

    function test_launchToken_revertsWhenHooksNotAllowed() public {
        vm.expectRevert(Launchpad.HookNotAllowed.selector);
        launchpad.launchToken("Hooked", "HOOK", ETH, HOOKS);
    }

    function test_launchToken_revertsWhenHooksWereDisallowed() public {
        launchpad.setHookAllowed(HOOKS, true);
        launchpad.setHookAllowed(HOOKS, false);

        vm.expectRevert(Launchpad.HookNotAllowed.selector);
        launchpad.launchToken("Hooked", "HOOK", ETH, HOOKS);
    }

    function test_setHookAllowed_revertsWhenCallerIsNotOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Launchpad.NotOwner.selector);
        launchpad.setHookAllowed(HOOKS, true);
    }

    function test_initialize_revertsWhenCalledTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        launchpad.initialize(address(1), Launchpad.Config(1, 0, 1), ETH, 0);
    }

    function test_initialize_revertsOnImplementation() public {
        Launchpad implementation = new Launchpad(poolManager);

        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(address(1), Launchpad.Config(1, 0, 1), ETH, 0);
    }

    function test_upgrade_ownerSwitchesImplementationAndKeepsState() public {
        address tokenLaunchedBeforeUpgrade = launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS);

        launchpad.upgradeToAndCall(address(new LaunchpadV2(poolManager)), "");

        assertEq(LaunchpadV2(address(launchpad)).version(), 2);
        assertEq(launchpad.owner(), address(this));
        assertEq(launchpad.launchCount(), 1);
        assertTrue(launchpad.launchToken("Test Token", "TEST", ETH, NO_HOOKS) != tokenLaunchedBeforeUpgrade);
    }

    function test_upgrade_revertsWhenCallerIsNotOwner() public {
        address newImplementation = address(new LaunchpadV2(poolManager));

        vm.prank(address(0xBEEF));
        vm.expectRevert(Launchpad.NotOwner.selector);
        launchpad.upgradeToAndCall(newImplementation, "");
    }

    receive() external payable {}
}
