// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {CustomRevert} from "@uniswap/v4-core/src/libraries/CustomRevert.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {ILaunchpad} from "../src/interfaces/ILaunchpad.sol";
import {FeeHook} from "../src/hooks/FeeHook.sol";

contract FeeHookTest is Test {
    using CurrencyLibrary for Currency;

    uint256 constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 constant INITIAL_MARKETCAP = 3000e18;
    uint24 constant POOL_FEE = 0;
    int24 constant TICK_SPACING = 200;
    uint16 constant PROTOCOL_FEE_BPS = 50;
    uint16 constant LAUNCHPAD_FEE_BPS = 100;
    uint16 constant CREATOR_FEE_BPS = 150;
    Currency constant ETH = Currency.wrap(address(0));

    uint160 constant HOOK_FLAGS = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG;
    FeeHook constant HOOK = FeeHook(payable(address(uint160(0x4444 << 144) | HOOK_FLAGS)));

    address factoryOwner = makeAddr("factoryOwner");
    address launchpadOwner = makeAddr("launchpadOwner");
    address creator = makeAddr("creator");
    address trader = makeAddr("trader");

    IPoolManager poolManager;
    PoolSwapTest swapRouter;
    LaunchpadFactory factory;
    Launchpad launchpad;
    IB20 token;

    function setUp() public {
        poolManager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(poolManager);
        factory = new LaunchpadFactory(factoryOwner, address(new Launchpad(poolManager)));
        deployCodeTo("FeeHook.sol:FeeHook", abi.encode(poolManager, factory), address(HOOK));

        vm.startPrank(factoryOwner);
        factory.setHookAllowed(IHooks(address(HOOK)), true);
        factory.setQuotePrice(ETH, 3000e18);
        factory.setProtocolFee(PROTOCOL_FEE_BPS);
        vm.stopPrank();

        launchpad = createLaunchpad(setupHookFee(LAUNCHPAD_FEE_BPS, CREATOR_FEE_BPS));
        vm.prank(creator);
        token = IB20(launchpad.launchToken("Fee Token", "FEE", ETH));

        vm.deal(trader, 100 ether);
        vm.prank(trader);
        token.approve(address(swapRouter), type(uint256).max);
    }

    function createLaunchpad(bytes memory hookCall) internal returns (Launchpad) {
        Currency[] memory quoteTokens = new Currency[](1);
        quoteTokens[0] = ETH;
        return Launchpad(
            factory.createLaunchpad(
                abi.encodeCall(
                    ILaunchpad.initialize,
                    (
                        launchpadOwner,
                        ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, TICK_SPACING, IHooks(address(HOOK))),
                        quoteTokens,
                        hookCall
                    )
                )
            )
        );
    }

    function setupHookFee(uint16 launchpadFeeBps, uint16 creatorFeeBps) internal pure returns (bytes memory) {
        return abi.encodeCall(FeeHook.setupHookFee, (launchpadFeeBps, creatorFeeBps));
    }

    function poolKey() internal view returns (PoolKey memory) {
        return PoolKey(ETH, Currency.wrap(address(token)), POOL_FEE, TICK_SPACING, IHooks(address(HOOK)));
    }

    function swap(bool ethForToken, int256 amountSpecified, uint256 value) internal {
        vm.prank(trader);
        swapRouter.swap{value: value}(
            poolKey(),
            SwapParams(
                ethForToken, amountSpecified, ethForToken ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            ),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
    }

    function feesHeldByHook() internal view returns (uint256) {
        return poolManager.balanceOf(address(HOOK), ETH.toId());
    }

    function assertFeesSplit(uint256 ethVolume) internal view {
        uint256 roundingWei = 2;
        assertApproxEqAbs(
            HOOK.collectableFees(address(factory), ETH), ethVolume * PROTOCOL_FEE_BPS / 10_000, roundingWei, "protocol"
        );
        assertApproxEqAbs(
            HOOK.collectableFees(address(launchpad), ETH),
            ethVolume * LAUNCHPAD_FEE_BPS / 10_000,
            roundingWei,
            "launchpad"
        );
        assertApproxEqAbs(
            HOOK.collectableFees(creator, ETH), ethVolume * CREATOR_FEE_BPS / 10_000, roundingWei, "creator"
        );
        assertEq(
            feesHeldByHook(),
            HOOK.collectableFees(address(factory), ETH) + HOOK.collectableFees(address(launchpad), ETH)
                + HOOK.collectableFees(creator, ETH),
            "buckets add up to what the hook holds"
        );
    }

    function test_buyWithExactEth_takesFeeFromEthPaid() public {
        swap(true, -1 ether, 1 ether);

        assertFeesSplit(1 ether);
        assertEq(trader.balance, 99 ether);
        assertGt(token.balanceOf(trader), 0);
    }

    function test_buyExactTokens_addsFeeOnTopOfEthPaid() public {
        swap(true, 1_000_000e18, 1 ether);

        uint256 ethPaid = 100 ether - trader.balance;
        uint256 ethIntoPool = ethPaid - feesHeldByHook();
        assertEq(token.balanceOf(trader), 1_000_000e18);
        assertFeesSplit(ethIntoPool);
    }

    function test_sellExactTokens_takesFeeFromEthReceived() public {
        swap(true, -1 ether, 1 ether);
        uint256 feesFromBuy = feesHeldByHook();
        uint256 ethBeforeSell = trader.balance;

        swap(false, -int256(token.balanceOf(trader) / 2), 0);

        uint256 ethReceived = trader.balance - ethBeforeSell;
        uint256 feesFromSell = feesHeldByHook() - feesFromBuy;
        assertGt(ethReceived, 0);
        assertApproxEqAbs(feesFromSell, (ethReceived + feesFromSell) * 300 / 10_000, 3);
    }

    function test_sellForExactEth_traderReceivesExactAmountAndPaysFeeInTokens() public {
        swap(true, -1 ether, 1 ether);
        uint256 feesFromBuy = feesHeldByHook();
        uint256 ethBeforeSell = trader.balance;

        swap(false, 0.1 ether, 0);

        assertEq(trader.balance - ethBeforeSell, 0.1 ether);
        assertEq(feesHeldByHook() - feesFromBuy, 0.1 ether * 300 / 10_000);
    }

    function test_collectFees_eachRecipientCollectsOwnBucket() public {
        swap(true, -1 ether, 1 ether);

        vm.prank(factoryOwner);
        HOOK.collectFees(address(factory), ETH, factoryOwner);
        vm.prank(launchpadOwner);
        HOOK.collectFees(address(launchpad), ETH, launchpadOwner);
        vm.prank(creator);
        HOOK.collectFees(creator, ETH, creator);

        assertEq(factoryOwner.balance, 0.005 ether);
        assertEq(launchpadOwner.balance, 0.01 ether);
        assertEq(creator.balance, 0.015 ether);
        assertEq(feesHeldByHook(), 0);
        assertEq(HOOK.collectableFees(creator, ETH), 0);
    }

    function test_collectFees_revertsForSomeoneElsesBucket() public {
        swap(true, -1 ether, 1 ether);

        vm.startPrank(trader);
        vm.expectRevert(FeeHook.NotFeeRecipient.selector);
        HOOK.collectFees(address(factory), ETH, trader);
        vm.expectRevert(FeeHook.NotFeeRecipient.selector);
        HOOK.collectFees(address(launchpad), ETH, trader);
        vm.expectRevert(FeeHook.NotFeeRecipient.selector);
        HOOK.collectFees(creator, ETH, trader);
        vm.stopPrank();

        vm.prank(launchpadOwner);
        vm.expectRevert(FeeHook.NotFeeRecipient.selector);
        HOOK.collectFees(address(factory), ETH, launchpadOwner);
    }

    function test_collectFees_followsLaunchpadOwnershipTransfer() public {
        swap(true, -1 ether, 1 ether);
        address newOwner = makeAddr("newOwner");
        vm.prank(launchpadOwner);
        launchpad.transferOwnership(newOwner);

        vm.prank(newOwner);
        HOOK.collectFees(address(launchpad), ETH, newOwner);

        assertEq(newOwner.balance, 0.01 ether);
    }

    function test_protocolFeeChange_appliesToExistingPools() public {
        vm.prank(factoryOwner);
        factory.setProtocolFee(200);

        swap(true, -1 ether, 1 ether);

        assertEq(HOOK.collectableFees(address(factory), ETH), 0.02 ether);
        assertEq(HOOK.collectableFees(address(launchpad), ETH), 0.01 ether);
        assertEq(HOOK.collectableFees(creator, ETH), 0.015 ether);
    }

    function test_setupHookFee_storesFeesPerLaunchpad() public {
        Launchpad otherLaunchpad = createLaunchpad(setupHookFee(700, 0));

        (bool isSetUp, uint16 launchpadFeeBps, uint16 creatorFeeBps) = HOOK.launchpadFees(address(launchpad));
        assertTrue(isSetUp);
        assertEq(launchpadFeeBps, LAUNCHPAD_FEE_BPS);
        assertEq(creatorFeeBps, CREATOR_FEE_BPS);
        (, launchpadFeeBps, creatorFeeBps) = HOOK.launchpadFees(address(otherLaunchpad));
        assertEq(launchpadFeeBps, 700);
        assertEq(creatorFeeBps, 0);
    }

    function test_setupHookFee_revertsWhenLaunchpadFeesAlreadySetUp() public {
        vm.prank(address(launchpad));
        vm.expectRevert(FeeHook.FeesAlreadySetUp.selector);
        HOOK.setupHookFee(900, 0);
    }

    function test_setupHookFee_revertsWhenCallerIsNotLaunchpad() public {
        vm.prank(trader);
        vm.expectRevert(FeeHook.NotLaunchpad.selector);
        HOOK.setupHookFee(100, 100);
    }

    function test_launchpadWithoutHookCall_paysOnlyProtocolFee() public {
        Launchpad plainLaunchpad = createLaunchpad("");
        vm.prank(creator);
        IB20 plainToken = IB20(plainLaunchpad.launchToken("Plain", "PLN", ETH));

        vm.prank(trader);
        swapRouter.swap{value: 1 ether}(
            PoolKey(ETH, Currency.wrap(address(plainToken)), POOL_FEE, TICK_SPACING, IHooks(address(HOOK))),
            SwapParams(true, -1 ether, TickMath.MIN_SQRT_PRICE + 1),
            PoolSwapTest.TestSettings(false, false),
            ""
        );

        assertEq(HOOK.collectableFees(address(factory), ETH), 0.005 ether);
        assertEq(HOOK.collectableFees(address(plainLaunchpad), ETH), 0);
        assertEq(HOOK.collectableFees(creator, ETH), 0);
    }

    function test_erc20QuoteSortedAboveToken_feesAccrueAndPayOutInQuote() public {
        MockERC20 quote = MockERC20(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
        deployCodeTo("MockERC20.sol:MockERC20", abi.encode("Quote", "QUOTE", uint8(6)), address(quote));
        Currency quoteCurrency = Currency.wrap(address(quote));
        vm.prank(factoryOwner);
        factory.setQuotePrice(quoteCurrency, 1e30);
        vm.prank(launchpadOwner);
        launchpad.setQuoteEnabled(quoteCurrency, true);
        vm.prank(creator);
        address quotedToken = launchpad.launchToken("Quoted", "QTD", quoteCurrency);
        quote.mint(trader, 1000e6);

        vm.startPrank(trader);
        quote.approve(address(swapRouter), type(uint256).max);
        swapRouter.swap(
            PoolKey(Currency.wrap(quotedToken), quoteCurrency, POOL_FEE, TICK_SPACING, IHooks(address(HOOK))),
            SwapParams(false, -100e6, TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
        vm.stopPrank();

        assertEq(quote.balanceOf(trader), 900e6);
        assertGt(IB20(quotedToken).balanceOf(trader), 0);
        assertEq(HOOK.collectableFees(address(factory), quoteCurrency), 0.5e6);
        assertEq(HOOK.collectableFees(address(launchpad), quoteCurrency), 1e6);
        assertEq(HOOK.collectableFees(creator, quoteCurrency), 1.5e6);

        vm.prank(creator);
        HOOK.collectFees(creator, quoteCurrency, creator);
        assertEq(quote.balanceOf(creator), 1.5e6);
    }

    function test_setProtocolFee_revertsWhenCallerIsNotFactoryOwner() public {
        vm.prank(launchpadOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, launchpadOwner));
        factory.setProtocolFee(1);
    }

    function test_setProtocolFee_revertsAboveCap() public {
        vm.prank(factoryOwner);
        vm.expectRevert(LaunchpadFactory.ProtocolFeeTooHigh.selector);
        factory.setProtocolFee(501);
    }

    function test_createLaunchpad_revertsWhenLaunchpadFeesAboveCap() public {
        bytes memory hookCall = setupHookFee(600, 401);

        vm.expectRevert(FeeHook.LaunchpadFeesTooHigh.selector);
        createLaunchpad(hookCall);
    }

    function test_initializePool_revertsWhenSenderIsNotLaunchpad() public {
        PoolKey memory foreignPool = PoolKey(ETH, Currency.wrap(address(token)), 3000, 60, IHooks(address(HOOK)));

        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(HOOK),
                IHooks.beforeInitialize.selector,
                abi.encodeWithSelector(FeeHook.NotLaunchpad.selector),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        poolManager.initialize(foreignPool, TickMath.getSqrtPriceAtTick(0));
    }
}
