// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
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
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ILaunchpad} from "../src/interfaces/ILaunchpad.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";

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
    uint256 constant INITIAL_MARKETCAP = 3000e18;
    uint256 constant QUOTE_PRICE = 3000e18;
    int24 constant STARTING_TICK = 207200;
    uint24 constant POOL_FEE = 10000;
    int24 constant TICK_SPACING = 200;

    Currency constant ETH = Currency.wrap(address(0));
    Currency constant QUOTE_BELOW_B20 = Currency.wrap(0x1111111111111111111111111111111111111111);
    Currency constant QUOTE_ABOVE_B20 = Currency.wrap(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    IHooks constant HOOKS = IHooks(address(uint160(0x4444 << 144) | uint160(Hooks.BEFORE_INITIALIZE_FLAG)));
    IHooks constant OTHER_HOOKS = IHooks(address(uint160(0x5555 << 144) | uint160(Hooks.BEFORE_INITIALIZE_FLAG)));

    address factoryOwner = makeAddr("factoryOwner");
    address stranger = makeAddr("stranger");

    IPoolManager poolManager;
    PoolSwapTest swapRouter;
    LaunchpadFactory factory;
    Launchpad launchpad;

    function setUp() public {
        poolManager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(poolManager);
        factory = new LaunchpadFactory(factoryOwner, address(new Launchpad(poolManager)));
        deployCodeTo("NoopHook.sol:NoopHook", address(HOOKS));
        vm.startPrank(factoryOwner);
        factory.setHookAllowed(HOOKS, true);
        factory.setQuotePrice(ETH, QUOTE_PRICE);
        factory.setQuotePrice(QUOTE_BELOW_B20, QUOTE_PRICE);
        factory.setQuotePrice(QUOTE_ABOVE_B20, QUOTE_PRICE);
        vm.stopPrank();
        launchpad = Launchpad(
            factory.createLaunchpad(
                abi.encodeCall(
                    ILaunchpad.initialize,
                    (
                        address(this),
                        ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, HOOKS),
                        onlyEth()
                    )
                )
            )
        );
        deployQuoteToken(QUOTE_BELOW_B20);
        deployQuoteToken(QUOTE_ABOVE_B20);
    }

    function onlyEth() internal pure returns (Currency[] memory quoteTokens) {
        quoteTokens = new Currency[](1);
        quoteTokens[0] = ETH;
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
            poolKeyOf(token, quoteToken, HOOKS),
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
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH));

        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_launchToken_emitsPoolIdOfCreatedPool() public {
        vm.recordLogs();

        address token = launchpad.launchToken("Test Token", "TEST", ETH);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory tokenLaunched = logs[logs.length - 1];
        assertEq(tokenLaunched.topics[0], ILaunchpad.TokenLaunched.selector);
        assertEq(tokenLaunched.topics[3], PoolId.unwrap(poolKeyOf(token, ETH, HOOKS).toId()));
    }

    function test_launchToken_putsWholeSupplyIntoPoolAtStartingPrice() public {
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH));

        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolKeyOf(address(token), ETH, HOOKS).toId());
        assertEq(sqrtPriceX96, TickMath.getSqrtPriceAtTick(STARTING_TICK));
        assertEq(tick, STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);
        assertEq(address(poolManager).balance, 0);
    }

    function test_launchToken_tokenIsBuyableWithEthRightAway() public {
        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH));

        buy(address(token), ETH, 1 ether);

        assertGt(token.balanceOf(address(this)), 0);
        (, int24 tick,,) = poolManager.getSlot0(poolKeyOf(address(token), ETH, HOOKS).toId());
        assertLt(tick, STARTING_TICK);
    }

    function test_launchToken_againstQuoteTokenSortedBelowToken() public {
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", QUOTE_BELOW_B20));

        PoolId poolId = poolKeyOf(address(token), QUOTE_BELOW_B20, HOOKS).toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        assertEq(tick, STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);

        buy(address(token), QUOTE_BELOW_B20, 1 ether);
        assertGt(token.balanceOf(address(this)), 0);
    }

    function test_launchToken_againstQuoteTokenSortedAboveTokenMirrorsThePrice() public {
        launchpad.setQuoteEnabled(QUOTE_ABOVE_B20, true);

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", QUOTE_ABOVE_B20));

        PoolId poolId = poolKeyOf(address(token), QUOTE_ABOVE_B20, HOOKS).toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        assertEq(tick, -STARTING_TICK);
        assertApproxEqAbs(token.balanceOf(address(poolManager)), TOTAL_SUPPLY, 1e6);

        buy(address(token), QUOTE_ABOVE_B20, 1 ether);
        assertGt(token.balanceOf(address(this)), 0);
        (, tick,,) = poolManager.getSlot0(poolId);
        assertGt(tick, -STARTING_TICK);
    }

    function test_launchToken_sameQuoteAmountBuysSameTokenAmountInBothSortOrders() public {
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);
        launchpad.setQuoteEnabled(QUOTE_ABOVE_B20, true);
        IB20 tokenAboveQuote = IB20(launchpad.launchToken("A", "A", QUOTE_BELOW_B20));
        IB20 tokenBelowQuote = IB20(launchpad.launchToken("B", "B", QUOTE_ABOVE_B20));

        buy(address(tokenAboveQuote), QUOTE_BELOW_B20, 1 ether);
        buy(address(tokenBelowQuote), QUOTE_ABOVE_B20, 1 ether);

        assertApproxEqRel(tokenAboveQuote.balanceOf(address(this)), tokenBelowQuote.balanceOf(address(this)), 1e12);
    }

    function initialMarketcapInQuote(address token, Currency quoteToken) internal view returns (uint256) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKeyOf(token, quoteToken, HOOKS).toId());
        uint256 priceX96 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 96);
        return Currency.unwrap(quoteToken) < token
            ? FullMath.mulDiv(TOTAL_SUPPLY, 1 << 96, priceX96)
            : FullMath.mulDiv(TOTAL_SUPPLY, priceX96, 1 << 96);
    }

    function test_launchToken_startsAtConfiguredMarketcapInBothSortOrders() public {
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);
        launchpad.setQuoteEnabled(QUOTE_ABOVE_B20, true);

        address tokenAboveQuote = launchpad.launchToken("A", "A", QUOTE_BELOW_B20);
        address tokenBelowQuote = launchpad.launchToken("B", "B", QUOTE_ABOVE_B20);

        assertApproxEqRel(initialMarketcapInQuote(tokenAboveQuote, QUOTE_BELOW_B20), 1 ether, 0.021e18);
        assertApproxEqRel(initialMarketcapInQuote(tokenBelowQuote, QUOTE_ABOVE_B20), 1 ether, 0.021e18);
    }

    function test_launchToken_startsAtConfiguredMarketcapAgainstSixDecimalsStablecoin() public {
        vm.prank(factoryOwner);
        factory.setQuotePrice(QUOTE_BELOW_B20, 1e30);
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);

        address token = launchpad.launchToken("Test Token", "TEST", QUOTE_BELOW_B20);

        assertApproxEqRel(initialMarketcapInQuote(token, QUOTE_BELOW_B20), 3000e6, 0.021e18);
    }

    function test_launchToken_startingPriceFollowsQuotePrice() public {
        address tokenAtOldPrice = launchpad.launchToken("A", "A", ETH);
        vm.prank(factoryOwner);
        factory.setQuotePrice(ETH, QUOTE_PRICE * 2);

        address tokenAtNewPrice = launchpad.launchToken("B", "B", ETH);

        assertApproxEqRel(initialMarketcapInQuote(tokenAtOldPrice, ETH), 1 ether, 0.021e18);
        assertApproxEqRel(initialMarketcapInQuote(tokenAtNewPrice, ETH), 0.5 ether, 0.021e18);
    }

    function test_launchToken_revertsWhenFactoryHasNoQuotePrice() public {
        vm.prank(factoryOwner);
        factory.setQuotePrice(ETH, 0);

        vm.expectRevert(LaunchpadFactory.QuotePriceNotSet.selector);
        launchpad.launchToken("Test Token", "TEST", ETH);
    }

    function testFuzz_launchToken_succeedsForAnyInitialMarketcapInBothSortOrders(uint256 initialMarketcap) public {
        initialMarketcap = bound(initialMarketcap, 100e18, 1_000_000_000e18);
        launchpad.setConfig(ILaunchpad.Config(TOTAL_SUPPLY, initialMarketcap, POOL_FEE, TICK_SPACING, HOOKS));
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);
        launchpad.setQuoteEnabled(QUOTE_ABOVE_B20, true);

        launchpad.launchToken("A", "A", QUOTE_BELOW_B20);
        launchpad.launchToken("B", "B", QUOTE_ABOVE_B20);
    }

    function test_launchToken_revertsWhenQuoteNotEnabled() public {
        vm.expectRevert(ILaunchpad.QuoteNotEnabled.selector);
        launchpad.launchToken("Test Token", "TEST", QUOTE_BELOW_B20);
    }

    function test_launchToken_revertsWhenQuoteWasDisabled() public {
        launchpad.setQuoteEnabled(ETH, false);

        vm.expectRevert(ILaunchpad.QuoteNotEnabled.selector);
        launchpad.launchToken("Test Token", "TEST", ETH);
    }

    function test_setConfig_nextLaunchesUseNewConfig() public {
        launchpad.setConfig(ILaunchpad.Config(TOTAL_SUPPLY / 2, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, HOOKS));

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH));

        assertEq(token.totalSupply(), TOTAL_SUPPLY / 2);
    }

    function test_setConfig_revertsWhenCallerIsNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        launchpad.setConfig(ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, HOOKS));
    }

    function test_setQuoteEnabled_revertsWhenFactoryHasNoQuotePrice() public {
        vm.expectRevert(LaunchpadFactory.QuotePriceNotSet.selector);
        launchpad.setQuoteEnabled(Currency.wrap(address(0x2222)), true);
    }

    function test_setQuoteEnabled_disablesQuoteEvenWhenFactoryHasNoQuotePrice() public {
        vm.prank(factoryOwner);
        factory.setQuotePrice(ETH, 0);

        launchpad.setQuoteEnabled(ETH, false);

        assertFalse(launchpad.isQuoteEnabled(ETH));
    }

    function test_setQuoteEnabled_revertsWhenCallerIsNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        launchpad.setQuoteEnabled(QUOTE_BELOW_B20, true);
    }

    function test_launchToken_eachLaunchGetsItsOwnToken() public {
        address first = launchpad.launchToken("Same", "SAME", ETH);
        address second = launchpad.launchToken("Same", "SAME", ETH);

        assertTrue(first != second);
    }

    function test_launchToken_revertsWhenConfiguredHooksWereDisallowedByFactory() public {
        vm.prank(factoryOwner);
        factory.setHookAllowed(HOOKS, false);

        vm.expectRevert(ILaunchpad.HookNotAllowed.selector);
        launchpad.launchToken("Hooked", "HOOK", ETH);
    }

    function test_setConfig_revertsWhenHooksNotAllowedByFactory() public {
        vm.expectRevert(ILaunchpad.HookNotAllowed.selector);
        launchpad.setConfig(ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, OTHER_HOOKS));
    }

    function test_setConfig_revertsWithoutHooksUnlessFactoryAllowsIt() public {
        ILaunchpad.Config memory hookless =
            ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, IHooks(address(0)));

        vm.expectRevert(ILaunchpad.HookNotAllowed.selector);
        launchpad.setConfig(hookless);

        vm.prank(factoryOwner);
        factory.setHookAllowed(IHooks(address(0)), true);
        launchpad.setConfig(hookless);
        address token = launchpad.launchToken("Hookless", "NOHOOK", ETH);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKeyOf(token, ETH, IHooks(address(0))).toId());
        assertGt(sqrtPriceX96, 0);
    }

    function test_setConfig_switchesHooksForNextLaunches() public {
        deployCodeTo("NoopHook.sol:NoopHook", address(OTHER_HOOKS));
        vm.prank(factoryOwner);
        factory.setHookAllowed(OTHER_HOOKS, true);

        launchpad.setConfig(ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING, OTHER_HOOKS));
        address token = launchpad.launchToken("Test Token", "TEST", ETH);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKeyOf(token, ETH, OTHER_HOOKS).toId());
        assertGt(sqrtPriceX96, 0);
    }

    function test_initialize_revertsWhenCalledTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        launchpad.initialize(address(1), ILaunchpad.Config(1, 1, 0, 1, HOOKS), onlyEth());
    }

    function test_initialize_revertsOnImplementation() public {
        Launchpad implementation = new Launchpad(poolManager);

        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(address(1), ILaunchpad.Config(1, 1, 0, 1, HOOKS), onlyEth());
    }

    function test_upgrade_factoryOwnerSwitchesImplementationAndKeepsState() public {
        address tokenLaunchedBeforeUpgrade = launchpad.launchToken("Test Token", "TEST", ETH);
        address newImplementation = address(new LaunchpadV2(poolManager));

        vm.prank(factoryOwner);
        launchpad.upgradeToAndCall(newImplementation, "");

        assertEq(LaunchpadV2(address(launchpad)).version(), 2);
        assertEq(launchpad.owner(), address(this));
        assertEq(launchpad.launchCount(), 1);
        assertTrue(launchpad.launchToken("Test Token", "TEST", ETH) != tokenLaunchedBeforeUpgrade);
    }

    function test_upgrade_revertsWhenCallerIsLaunchpadOwner() public {
        address newImplementation = address(new LaunchpadV2(poolManager));

        vm.expectRevert(ILaunchpad.NotFactoryOwner.selector);
        launchpad.upgradeToAndCall(newImplementation, "");
    }

    receive() external payable {}
}
