// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThesisBasket} from "../src/ThesisBasket.sol";
import {ThesisFactory} from "../src/ThesisFactory.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTradeRouter} from "./mocks/MockTradeRouter.sol";

contract ThesisFactoryTest is Test {
    uint256 private constant ONE_USDT = 1e6;

    MockERC20 internal usdt;
    MockERC20 internal xnvda;
    MockERC20 internal xamd;
    MockTradeRouter internal router;
    ThesisFactory internal factory;

    address internal agent = makeAddr("agent");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    address[] internal semis;

    event BasketCreated(
        address indexed basket,
        address indexed creator,
        uint256 indexed index,
        string name,
        string symbol,
        string theme,
        address[] constituents
    );

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        xnvda = new MockERC20("NVIDIA xStock", "XNVDA", 18);
        xamd = new MockERC20("AMD xStock", "XAMD", 18);
        router = new MockTradeRouter();
        router.setRate(address(usdt), address(xnvda), 1e18, 100 * ONE_USDT);
        router.setRate(address(usdt), address(xamd), 1e18, 50 * ONE_USDT);

        semis = [address(xnvda), address(xamd)];
        factory = new ThesisFactory(IERC20(address(usdt)), ITradeRouter(address(router)), agent);
    }

    /* ------------------------------------------------------------------ setup */

    function test_ConstructorStoresSharedConfiguration() public view {
        assertEq(address(factory.quoteToken()), address(usdt));
        assertEq(address(factory.router()), address(router));
        assertEq(factory.agent(), agent);
        assertEq(factory.basketCount(), 0);
    }

    function test_RevertWhen_ConstructedWithZeroAgent() public {
        vm.expectRevert(ThesisFactory.ZeroAddress.selector);
        new ThesisFactory(IERC20(address(usdt)), ITradeRouter(address(router)), address(0));
    }

    function test_RevertWhen_ConstructedWithZeroQuoteToken() public {
        vm.expectRevert(ThesisFactory.ZeroAddress.selector);
        new ThesisFactory(IERC20(address(0)), ITradeRouter(address(router)), agent);
    }

    /* ----------------------------------------------------------------- create */

    function test_CreateBasketWiresTheFactoryConfiguration() public {
        vm.prank(alice);
        ThesisBasket basket =
            ThesisBasket(_create("Thesis Semiconductors", "THESIS-SEMI", "semis, equal weight"));

        assertEq(basket.factory(), address(factory), "basket records its deployer");
        assertEq(basket.agent(), agent);
        assertEq(address(basket.quoteToken()), address(usdt));
        assertEq(address(basket.router()), address(router));
        assertEq(basket.theme(), "semis, equal weight");
        assertEq(basket.constituents(), semis);
        assertEq(basket.targetWeightBps(), 5_000);
    }

    function test_CreateBasketRegistersIt() public {
        vm.prank(alice);
        address basket = _create("Thesis Semiconductors", "THESIS-SEMI", "semis, equal weight");

        assertTrue(factory.isBasket(basket));
        assertEq(factory.creatorOf(basket), alice);
        assertEq(factory.basketCount(), 1);
        assertEq(factory.basketAt(0), basket);
        assertEq(factory.baskets()[0], basket);
        assertEq(factory.basketsOf(alice)[0], basket);
    }

    function test_CreateBasketEmitsTheRegistryEvent() public {
        vm.expectEmit(false, true, true, true, address(factory));
        emit BasketCreated(address(0), alice, 0, "Thesis Semiconductors", "THESIS-SEMI", "semis", semis);

        vm.prank(alice);
        _create("Thesis Semiconductors", "THESIS-SEMI", "semis");
    }

    function test_AnyoneCanCreateABasket() public {
        vm.prank(alice);
        address first = _create("Alice Semis", "A-SEMI", "semis");
        vm.prank(bob);
        address second = _create("Bob Semis", "B-SEMI", "semis again");

        assertEq(factory.basketCount(), 2);
        assertEq(factory.basketAt(1), second);
        assertEq(factory.basketsOf(alice).length, 1);
        assertEq(factory.basketsOf(bob).length, 1);
        assertTrue(first != second, "each theme gets its own basket");
    }

    function test_DuplicateThemesAreAllowed() public {
        vm.startPrank(alice);
        _create("One", "ONE", "semis, equal weight");
        _create("Two", "TWO", "semis, equal weight");
        vm.stopPrank();

        assertEq(factory.basketCount(), 2, "permissionless means no theme gatekeeping");
    }

    function test_BasketsFromTheFactoryMintNormally() public {
        vm.prank(alice);
        ThesisBasket basket = ThesisBasket(_create("Thesis Semiconductors", "THESIS-SEMI", "semis"));

        usdt.mint(bob, 1_000 * ONE_USDT);
        vm.startPrank(bob);
        usdt.approve(address(basket), 1_000 * ONE_USDT);
        uint256 shares = basket.mint(1_000 * ONE_USDT, 0);
        vm.stopPrank();

        assertEq(shares, 1_000e18);
        assertEq(xnvda.balanceOf(address(basket)), 5e18);
        assertEq(xamd.balanceOf(address(basket)), 10e18);
    }

    /* --------------------------------------------------------------- failures */

    function test_RevertWhen_CreatingWithDuplicateConstituents() public {
        address[] memory dupes = new address[](2);
        dupes[0] = address(xnvda);
        dupes[1] = address(xnvda);

        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.DuplicateConstituent.selector, address(xnvda)));
        factory.createBasket("Bad", "BAD", "broken", dupes);

        assertEq(factory.basketCount(), 0, "a failed deployment registers nothing");
    }

    function test_RevertWhen_CreatingWithNoConstituents() public {
        vm.expectRevert(ThesisBasket.NoConstituents.selector);
        factory.createBasket("Bad", "BAD", "broken", new address[](0));
    }

    function test_RevertWhen_ReadingPastTheEndOfTheRegistry() public {
        vm.expectRevert();
        factory.basketAt(0);
    }

    function test_UnknownAddressIsNotABasket() public view {
        assertFalse(factory.isBasket(address(0xdead)));
        assertEq(factory.creatorOf(address(0xdead)), address(0));
    }

    /* -------------------------------------------------------------- custody */

    function test_FactoryRejectsEther() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool sent,) = address(factory).call{value: 1 ether}("");

        assertFalse(sent, "factory has no receive or fallback");
        assertEq(address(factory).balance, 0);
    }

    function test_FactoryNeverHoldsTheQuoteToken() public {
        vm.prank(alice);
        ThesisBasket basket = ThesisBasket(_create("Thesis Semiconductors", "THESIS-SEMI", "semis"));

        usdt.mint(bob, 1_000 * ONE_USDT);
        vm.startPrank(bob);
        usdt.approve(address(basket), 1_000 * ONE_USDT);
        basket.mint(1_000 * ONE_USDT, 0);
        vm.stopPrank();

        assertEq(usdt.balanceOf(address(factory)), 0);
        assertEq(xnvda.balanceOf(address(factory)), 0);
    }

    function testFuzz_RegistryStaysConsistent(uint8 count) public {
        count = uint8(bound(count, 1, 12));

        for (uint256 i; i < count; ++i) {
            vm.prank(alice);
            _create("Thesis Semiconductors", "THESIS-SEMI", "semis");
        }

        assertEq(factory.basketCount(), count);
        assertEq(factory.basketsOf(alice).length, count);
        for (uint256 i; i < count; ++i) {
            address basket = factory.basketAt(i);
            assertTrue(factory.isBasket(basket));
            assertEq(factory.creatorOf(basket), alice);
        }
    }

    /* ---------------------------------------------------------------- helpers */

    function _create(string memory name_, string memory symbol_, string memory theme_)
        private
        returns (address)
    {
        return factory.createBasket(name_, symbol_, theme_, semis);
    }
}
