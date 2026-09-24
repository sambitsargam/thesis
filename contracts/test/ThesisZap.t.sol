// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThesisBasket} from "../src/ThesisBasket.sol";
import {ThesisZap} from "../src/ThesisZap.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTradeRouter} from "./mocks/MockTradeRouter.sol";

contract ThesisZapTest is Test {
    uint256 private constant ONE_USDT = 1e6;
    uint256 private constant ONE_SHARE = 1e18;

    MockERC20 internal usdt;
    MockERC20 internal xnvda;
    MockERC20 internal xamd;
    MockTradeRouter internal router;
    ThesisBasket internal basket;
    ThesisZap internal zap;

    address internal alice = makeAddr("alice");
    address internal agent = makeAddr("agent");
    address[] internal tokens;

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        xnvda = new MockERC20("NVIDIA xStock", "XNVDA", 18);
        xamd = new MockERC20("AMD xStock", "XAMD", 18);
        router = new MockTradeRouter();

        // Buy side: 100 and 50 USDT per share.
        router.setRate(address(usdt), address(xnvda), 1e18, 100 * ONE_USDT);
        router.setRate(address(usdt), address(xamd), 1e18, 50 * ONE_USDT);
        // Sell side: the same prices back into USDT.
        router.setRate(address(xnvda), address(usdt), 100 * ONE_USDT, 1e18);
        router.setRate(address(xamd), address(usdt), 50 * ONE_USDT, 1e18);

        tokens = [address(xnvda), address(xamd)];
        basket = new ThesisBasket(
            "Thesis Semis",
            "THESIS-SEMI",
            "semis",
            IERC20(address(usdt)),
            ITradeRouter(address(router)),
            agent,
            tokens
        );
        zap = new ThesisZap(ITradeRouter(address(router)));

        _mintFor(alice, 1_000 * ONE_USDT);
    }

    /* ------------------------------------------------------------------- sell */

    function test_SellsWholePositionBackToQuoteToken() public {
        uint256 shares = basket.balanceOf(alice);

        vm.startPrank(alice);
        basket.approve(address(zap), shares);
        uint256 quoteOut = zap.sellForQuote(basket, shares, _blobs(2), 0);
        vm.stopPrank();

        assertEq(quoteOut, 1_000 * ONE_USDT, "round trip returns the deposit at flat prices");
        assertEq(usdt.balanceOf(alice), 1_000 * ONE_USDT);
        assertEq(basket.balanceOf(alice), 0, "shares burned");
        assertEq(basket.totalSupply(), 0);
    }

    function test_SellsPartOfAPosition() public {
        vm.startPrank(alice);
        basket.approve(address(zap), 400 * ONE_SHARE);
        uint256 quoteOut = zap.sellForQuote(basket, 400 * ONE_SHARE, _blobs(2), 0);
        vm.stopPrank();

        assertEq(quoteOut, 400 * ONE_USDT);
        assertEq(basket.balanceOf(alice), 600 * ONE_SHARE, "the rest stays invested");
        assertGt(xnvda.balanceOf(address(basket)), 0);
    }

    function test_ZapKeepsNothing() public {
        uint256 shares = basket.balanceOf(alice);

        vm.startPrank(alice);
        basket.approve(address(zap), shares);
        zap.sellForQuote(basket, shares, _blobs(2), 0);
        vm.stopPrank();

        assertEq(usdt.balanceOf(address(zap)), 0, "no quote token retained");
        assertEq(xnvda.balanceOf(address(zap)), 0, "no equity retained");
        assertEq(xamd.balanceOf(address(zap)), 0);
        assertEq(basket.balanceOf(address(zap)), 0, "no shares retained");
    }

    function test_UnsoldConstituentsAreReturnedInKind() public {
        // The venue stops quoting one leg, so it cannot be sold.
        router.setRate(address(xamd), address(usdt), 0, 0);
        uint256 shares = basket.balanceOf(alice);

        vm.startPrank(alice);
        basket.approve(address(zap), shares);
        vm.expectRevert();
        zap.sellForQuote(basket, shares, _blobs(2), 0);
        vm.stopPrank();

        assertEq(basket.balanceOf(alice), shares, "a failed sale changes nothing");
    }

    /* --------------------------------------------------------------- failures */

    function test_RevertWhen_SlippageFloorNotMet() public {
        uint256 shares = basket.balanceOf(alice);

        vm.startPrank(alice);
        basket.approve(address(zap), shares);
        vm.expectRevert(
            abi.encodeWithSelector(
                ThesisZap.InsufficientQuoteOut.selector, 1_000 * ONE_USDT, 1_001 * ONE_USDT
            )
        );
        zap.sellForQuote(basket, shares, _blobs(2), 1_001 * ONE_USDT);
        vm.stopPrank();
    }

    function test_RevertWhen_SellingZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(ThesisZap.ZeroAmount.selector);
        zap.sellForQuote(basket, 0, _blobs(2), 0);
    }

    function test_RevertWhen_SwapDataCountIsWrong() public {
        vm.startPrank(alice);
        basket.approve(address(zap), 1 * ONE_SHARE);
        vm.expectRevert(
            abi.encodeWithSelector(ThesisZap.SwapDataLengthMismatch.selector, uint256(1), uint256(2))
        );
        zap.sellForQuote(basket, 1 * ONE_SHARE, _blobs(1), 0);
        vm.stopPrank();
    }

    function test_RevertWhen_BasketUsesADifferentRouter() public {
        ThesisZap otherZap = new ThesisZap(ITradeRouter(address(new MockTradeRouter())));
        uint256 shares = basket.balanceOf(alice);

        vm.startPrank(alice);
        basket.approve(address(otherZap), shares);
        vm.expectRevert(
            abi.encodeWithSelector(
                ThesisZap.RouterMismatch.selector, address(router), address(otherZap.router())
            )
        );
        otherZap.sellForQuote(basket, shares, _blobs(2), 0);
        vm.stopPrank();
    }

    function test_RevertWhen_SharesNotApproved() public {
        vm.prank(alice);
        vm.expectRevert();
        zap.sellForQuote(basket, 1 * ONE_SHARE, _blobs(2), 0);
    }

    function testFuzz_RoundTripAtFlatPricesIsLossless(uint256 quoteAmount) public {
        quoteAmount = bound(quoteAmount, 100 * ONE_USDT, 100_000 * ONE_USDT);

        address bob = makeAddr("bob");
        _mintFor(bob, quoteAmount);
        uint256 shares = basket.balanceOf(bob);

        vm.startPrank(bob);
        basket.approve(address(zap), shares);
        uint256 quoteOut = zap.sellForQuote(basket, shares, _blobs(2), 0);
        vm.stopPrank();

        // Rounding only ever favours the basket, never the seller.
        assertLe(quoteOut, quoteAmount);
        assertGe(quoteOut, quoteAmount - 4, "at most dust is lost to rounding");
    }

    /* ---------------------------------------------------------------- helpers */

    function _blobs(uint256 n) private pure returns (bytes[] memory data) {
        data = new bytes[](n);
        for (uint256 i; i < n; ++i) {
            data[i] = hex"01";
        }
    }

    function _mintFor(address who, uint256 quoteAmount) private {
        usdt.mint(who, quoteAmount);
        vm.startPrank(who);
        usdt.approve(address(basket), quoteAmount);
        basket.mint(quoteAmount, 0, _blobs(2));
        vm.stopPrank();
    }
}
