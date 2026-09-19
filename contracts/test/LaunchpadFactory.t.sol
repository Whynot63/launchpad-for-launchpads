// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ILaunchpad} from "../src/interfaces/ILaunchpad.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";

contract LaunchpadFactoryTest is Test {
    uint256 constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 constant INITIAL_MARKETCAP = 3000e18;
    uint24 constant POOL_FEE = 10000;
    int24 constant TICK_SPACING = 200;
    Currency constant ETH = Currency.wrap(address(0));
    Currency constant STABLECOIN = Currency.wrap(address(0x1111));
    IHooks constant HOOKS = IHooks(address(uint160(0x4444 << 144) | uint160(Hooks.BEFORE_INITIALIZE_FLAG)));

    address factoryOwner = makeAddr("factoryOwner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    IPoolManager poolManager;
    LaunchpadFactory factory;

    event LaunchpadCreated(address indexed launchpad, address indexed creator);

    function setUp() public {
        poolManager = new PoolManager(address(this));
        factory = new LaunchpadFactory(factoryOwner, address(new Launchpad(poolManager)));
        vm.startPrank(factoryOwner);
        factory.setQuotePrice(ETH, 3000e18);
        factory.setQuotePrice(STABLECOIN, 1e30);
        vm.stopPrank();
    }

    function createLaunchpadAs(address creator) internal returns (Launchpad) {
        Currency[] memory quoteTokens = new Currency[](2);
        quoteTokens[0] = ETH;
        quoteTokens[1] = STABLECOIN;
        vm.prank(creator);
        return Launchpad(
            factory.createLaunchpad(
                abi.encodeCall(
                    ILaunchpad.initialize,
                    (creator, ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING), quoteTokens)
                )
            )
        );
    }

    function test_createLaunchpad_initializesLaunchpadWithGivenCalldata() public {
        Launchpad launchpad = createLaunchpadAs(alice);

        assertEq(launchpad.owner(), alice);
        (uint256 totalSupply, uint256 initialMarketcap, uint24 poolFee, int24 tickSpacing) = launchpad.config();
        assertEq(totalSupply, TOTAL_SUPPLY);
        assertEq(initialMarketcap, INITIAL_MARKETCAP);
        assertEq(poolFee, POOL_FEE);
        assertEq(tickSpacing, TICK_SPACING);
        assertTrue(launchpad.isQuoteEnabled(ETH));
        assertTrue(launchpad.isQuoteEnabled(STABLECOIN));
        assertFalse(launchpad.isQuoteEnabled(Currency.wrap(address(0x2222))));
    }

    function test_createLaunchpad_revertsWhenQuoteTokenHasNoPrice() public {
        Currency[] memory quoteTokens = new Currency[](1);
        quoteTokens[0] = Currency.wrap(address(0x2222));

        vm.expectRevert(LaunchpadFactory.QuotePriceNotSet.selector);
        factory.createLaunchpad(
            abi.encodeCall(
                ILaunchpad.initialize,
                (alice, ILaunchpad.Config(TOTAL_SUPPLY, INITIAL_MARKETCAP, POOL_FEE, TICK_SPACING), quoteTokens)
            )
        );
    }

    function test_createLaunchpad_emitsLaunchpadCreated() public {
        vm.expectEmit(false, true, false, false);
        emit LaunchpadCreated(address(0), alice);

        createLaunchpadAs(alice);
    }

    function test_createLaunchpad_createdLaunchpadLaunchesTokens() public {
        deployCodeTo("BeforeInitializeHook.sol:BeforeInitializeHook", address(HOOKS));
        vm.prank(factoryOwner);
        factory.setHookAllowed(HOOKS, true);
        Launchpad launchpad = createLaunchpadAs(alice);

        IB20 token = IB20(launchpad.launchToken("Test Token", "TEST", ETH, HOOKS));

        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_createLaunchpad_launchpadsAreIndependent() public {
        Launchpad aliceLaunchpad = createLaunchpadAs(alice);
        Launchpad bobLaunchpad = createLaunchpadAs(bob);

        vm.prank(alice);
        aliceLaunchpad.setQuoteEnabled(ETH, false);

        assertTrue(address(aliceLaunchpad) != address(bobLaunchpad));
        assertTrue(bobLaunchpad.isQuoteEnabled(ETH));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        bobLaunchpad.setQuoteEnabled(ETH, false);
    }

    function test_createLaunchpad_remembersFactory() public {
        assertEq(address(createLaunchpadAs(alice).factory()), address(factory));
    }

    function test_setLaunchpadImplementation_newLaunchpadsUseNewImplementation() public {
        address newImplementation = address(new Launchpad(poolManager));

        vm.prank(factoryOwner);
        factory.setLaunchpadImplementation(newImplementation);

        assertEq(factory.launchpadImplementation(), newImplementation);
        bytes32 implementationSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        assertEq(
            address(uint160(uint256(vm.load(address(createLaunchpadAs(alice)), implementationSlot)))), newImplementation
        );
    }

    function test_setLaunchpadImplementation_revertsWhenCallerIsNotFactoryOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setLaunchpadImplementation(address(1));
    }

    function test_setHookAllowed_appliesToEveryLaunchpad() public {
        deployCodeTo("BeforeInitializeHook.sol:BeforeInitializeHook", address(HOOKS));
        Launchpad aliceLaunchpad = createLaunchpadAs(alice);
        Launchpad bobLaunchpad = createLaunchpadAs(bob);

        vm.prank(factoryOwner);
        factory.setHookAllowed(HOOKS, true);

        aliceLaunchpad.launchToken("Test Token", "TEST", ETH, HOOKS);
        bobLaunchpad.launchToken("Test Token", "TEST", ETH, HOOKS);
    }

    function test_setHookAllowed_revertsWhenCallerIsLaunchpadOwner() public {
        createLaunchpadAs(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setHookAllowed(HOOKS, true);
    }

    function test_quotePrice_returnsUsdValueOfQuoteAmount() public view {
        assertEq(factory.quotePrice(ETH, 1e18), 3000e18);
        assertEq(factory.quotePrice(ETH, 0.5e18), 1500e18);
    }

    function test_quotePrice_revertsWhenPriceNotSet() public {
        vm.expectRevert(LaunchpadFactory.QuotePriceNotSet.selector);
        factory.quotePrice(Currency.wrap(address(1)), 1e18);
    }

    function test_setQuotePrice_revertsWhenCallerIsNotFactoryOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setQuotePrice(ETH, 1);
    }
}
