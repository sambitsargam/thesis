// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ThesisBasket} from "../src/ThesisBasket.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTradeRouter} from "./mocks/MockTradeRouter.sol";

contract ThesisBasketTest is Test {
    uint256 private constant ONE_SHARE = 1e18;
    uint256 private constant ONE_USDT = 1e6;

    MockERC20 internal usdt;
    MockERC20 internal xnvda;
    MockERC20 internal xamd;
    MockERC20 internal xtsm;
    MockERC20 internal xasml;
    MockTradeRouter internal router;
    ThesisBasket internal basket;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal agent = makeAddr("agent");

    address[] internal tokens;

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        xnvda = new MockERC20("NVIDIA xStock", "XNVDA", 18);
        xamd = new MockERC20("AMD xStock", "XAMD", 18);
        xtsm = new MockERC20("TSMC xStock", "XTSM", 18);
        xasml = new MockERC20("ASML xStock", "XASML", 18);
        router = new MockTradeRouter();

        // One whole share of each equity costs 100, 50, 25 and 200 USDT respectively.
        _price(xnvda, 100);
        _price(xamd, 50);
        _price(xtsm, 25);
        _price(xasml, 200);

        // Rebalance-side pairs: sell an equity back to USDT, or straight into another.
        router.setRate(address(xnvda), address(usdt), 100 * ONE_USDT, 1e18);
        router.setRate(address(xnvda), address(xamd), 2e18, 1e18);

        tokens = [address(xnvda), address(xamd), address(xtsm), address(xasml)];
        basket = new ThesisBasket(
            "Thesis Semiconductors",
            "THESIS-SEMI",
            "semiconductor supply chain, equal weight",
            IERC20(address(usdt)),
            ITradeRouter(address(router)),
            agent,
            tokens
        );
    }

    /* ------------------------------------------------------------------ setup */

    function test_ConstructorStoresConfiguration() public view {
        assertEq(basket.theme(), "semiconductor supply chain, equal weight");
        assertEq(basket.constituentCount(), 4);
        assertEq(basket.targetWeightBps(), 2_500);
        assertEq(basket.factory(), address(this));
        assertEq(basket.agent(), agent);
        assertTrue(basket.isConstituent(address(xnvda)));
        assertFalse(basket.isConstituent(address(usdt)));
        assertEq(basket.decimals(), 18);
        assertEq(basket.constituents(), tokens);
    }

    function test_RevertWhen_ConstructedWithNoConstituents() public {
        vm.expectRevert(ThesisBasket.NoConstituents.selector);
        _deploy(new address[](0));
    }

    function test_RevertWhen_ConstructedWithTooManyConstituents() public {
        address[] memory many = new address[](basket.MAX_CONSTITUENTS() + 1);
        for (uint256 i; i < many.length; ++i) {
            many[i] = address(new MockERC20("x", "x", 18));
        }
        vm.expectRevert(ThesisBasket.TooManyConstituents.selector);
        _deploy(many);
    }

    function test_RevertWhen_ConstructedWithDuplicateConstituent() public {
        address[] memory dupes = new address[](2);
        dupes[0] = address(xnvda);
        dupes[1] = address(xnvda);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.DuplicateConstituent.selector, address(xnvda)));
        _deploy(dupes);
    }

    function test_RevertWhen_ConstructedWithZeroAddressConstituent() public {
        address[] memory withZero = new address[](1);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.InvalidConstituent.selector, address(0)));
        _deploy(withZero);
    }

    function test_RevertWhen_QuoteTokenIsAlsoAConstituent() public {
        address[] memory withQuote = new address[](1);
        withQuote[0] = address(usdt);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.InvalidConstituent.selector, address(usdt)));
        _deploy(withQuote);
    }

    /* ------------------------------------------------------------------- mint */

    function test_FirstMintPricesOneSharePerQuoteUnit() public {
        uint256 shares = _mintFor(alice, 1_000 * ONE_USDT);

        assertEq(shares, 1_000 * ONE_SHARE);
        assertEq(basket.balanceOf(alice), 1_000 * ONE_SHARE);
        assertEq(basket.totalSupply(), 1_000 * ONE_SHARE);
    }

    function test_MintSplitsDepositEquallyAcrossConstituents() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        // 250 USDT per leg at 100, 50, 25 and 200 USDT per share.
        assertEq(xnvda.balanceOf(address(basket)), 2.5e18);
        assertEq(xamd.balanceOf(address(basket)), 5e18);
        assertEq(xtsm.balanceOf(address(basket)), 10e18);
        assertEq(xasml.balanceOf(address(basket)), 1.25e18);
        assertEq(usdt.balanceOf(address(basket)), 0, "whole deposit deployed");
    }

    function test_MintSendsDivisionDustToLastLeg() public {
        uint256 amount = 1_000 * ONE_USDT + 3;
        _mintFor(alice, amount);

        uint256 perLeg = amount / 4;
        assertEq(xnvda.balanceOf(address(basket)), Math.mulDiv(perLeg, 1e18, 100 * ONE_USDT));
        assertEq(xasml.balanceOf(address(basket)), Math.mulDiv(perLeg + 3, 1e18, 200 * ONE_USDT));
        assertEq(usdt.balanceOf(address(router)), amount, "nothing stranded");
    }

    function test_SecondMintOfEqualSizeIsProportional() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        uint256 bobShares = _mintFor(bob, 1_000 * ONE_USDT);

        assertEq(bobShares, 1_000 * ONE_SHARE);
        assertEq(basket.totalSupply(), 2_000 * ONE_SHARE);
        assertEq(xnvda.balanceOf(address(basket)), 5e18);
    }

    function test_MintAfterAppreciationGivesFewerShares() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        // One leg doubles in size without new shares: existing holders got richer.
        xnvda.mint(address(basket), 2.5e18);

        uint256 bobShares = _mintFor(bob, 1_000 * ONE_USDT);

        assertLt(bobShares, 1_000 * ONE_SHARE, "minter must not capture the gain");
        assertEq(bobShares, 500 * ONE_SHARE, "priced off the scarcest leg");
        assertEq(basket.balanceOf(alice), 1_000 * ONE_SHARE);
    }

    function test_RevertWhen_MintAmountIsZero() public {
        vm.prank(alice);
        vm.expectRevert(ThesisBasket.ZeroAmount.selector);
        basket.mint(0, 0);
    }

    function test_RevertWhen_MintSlippageExceeded() public {
        _fund(alice, 1_000 * ONE_USDT);
        vm.startPrank(alice);
        usdt.approve(address(basket), 1_000 * ONE_USDT);
        vm.expectRevert(
            abi.encodeWithSelector(
                ThesisBasket.SlippageExceeded.selector, 1_000 * ONE_SHARE, 1_001 * ONE_SHARE
            )
        );
        basket.mint(1_000 * ONE_USDT, 1_001 * ONE_SHARE);
        vm.stopPrank();
    }

    function test_MintAcceptsTrailingBuilderCodeCalldata() public {
        _fund(alice, 1_000 * ONE_USDT);

        // ERC-8021 appends the builder code after the ABI-encoded arguments. Nothing in
        // the contract strips it, so this proves the decoder tolerates the suffix.
        bytes memory builderCode = hex"8021deadbeefcafe";
        bytes memory payload =
            bytes.concat(abi.encodeCall(ThesisBasket.mint, (1_000 * ONE_USDT, 0)), builderCode);

        vm.startPrank(alice);
        usdt.approve(address(basket), 1_000 * ONE_USDT);
        (bool ok, bytes memory ret) = address(basket).call(payload);
        vm.stopPrank();

        assertTrue(ok, "trailing builder code must not break dispatch");
        assertEq(abi.decode(ret, (uint256)), 1_000 * ONE_SHARE);
        assertEq(basket.balanceOf(alice), 1_000 * ONE_SHARE);
    }

    /* ----------------------------------------------------------------- redeem */

    function test_RedeemReturnsUnderlyingProRata() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(500 * ONE_SHARE);

        assertEq(amounts[0], 1.25e18);
        assertEq(amounts[3], 0.625e18);
        assertEq(xnvda.balanceOf(alice), 1.25e18);
        assertEq(basket.totalSupply(), 500 * ONE_SHARE);
        assertEq(xnvda.balanceOf(address(basket)), 1.25e18);
    }

    function test_RedeemAllEmptiesBasketForSoleHolder() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        uint256 aliceShares = basket.balanceOf(alice);
        vm.prank(alice);
        basket.redeem(aliceShares);

        assertEq(basket.totalSupply(), 0);
        for (uint256 i; i < tokens.length; ++i) {
            assertEq(IERC20(tokens[i]).balanceOf(address(basket)), 0, "no residue");
        }
    }

    function test_RedeemAllWithTwoHoldersLeavesAtMostDust() public {
        _mintFor(alice, 1_000 * ONE_USDT + 7);
        _mintFor(bob, 333 * ONE_USDT + 1);

        uint256 aliceShares = basket.balanceOf(alice);
        uint256 bobShares = basket.balanceOf(bob);
        vm.prank(alice);
        basket.redeem(aliceShares);
        vm.prank(bob);
        basket.redeem(bobShares);

        assertEq(basket.totalSupply(), 0);
        for (uint256 i; i < tokens.length; ++i) {
            assertLe(IERC20(tokens[i]).balanceOf(address(basket)), 2, "rounding dust only");
        }
    }

    function test_RevertWhen_RedeemAmountIsZero() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        vm.prank(alice);
        vm.expectRevert(ThesisBasket.ZeroAmount.selector);
        basket.redeem(0);
    }

    function test_RevertWhen_RedeemFromEmptyBasket() public {
        vm.prank(alice);
        vm.expectRevert(ThesisBasket.EmptyBasket.selector);
        basket.redeem(1);
    }

    /* -------------------------------------------------------------- rebalance */

    function test_RebalanceShiftsWeightBetweenConstituents() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        uint256 supplyBefore = basket.totalSupply();

        ThesisBasket.Leg[] memory legs = new ThesisBasket.Leg[](1);
        legs[0] = ThesisBasket.Leg({
            tokenIn: address(xnvda),
            tokenOut: address(xamd),
            amountIn: 0.5e18,
            minAmountOut: 1e18
        });

        vm.prank(agent);
        uint256[] memory amountsOut = basket.rebalance(legs);

        assertEq(amountsOut[0], 1e18, "one NVDA buys two AMD");
        assertEq(xnvda.balanceOf(address(basket)), 2e18);
        assertEq(xamd.balanceOf(address(basket)), 6e18);
        assertEq(basket.totalSupply(), supplyBefore, "rebalancing mints no shares");
    }

    function test_RebalanceMayRouteThroughTheQuoteToken() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        ThesisBasket.Leg[] memory legs = new ThesisBasket.Leg[](2);
        legs[0] = ThesisBasket.Leg({
            tokenIn: address(xnvda),
            tokenOut: address(usdt),
            amountIn: 0.5e18,
            minAmountOut: 50 * ONE_USDT
        });
        legs[1] = ThesisBasket.Leg({
            tokenIn: address(usdt),
            tokenOut: address(xamd),
            amountIn: 50 * ONE_USDT,
            minAmountOut: 1e18
        });

        vm.prank(agent);
        basket.rebalance(legs);

        assertEq(usdt.balanceOf(address(basket)), 0, "ends fully invested");
        assertEq(xamd.balanceOf(address(basket)), 6e18);
    }

    function test_RevertWhen_RebalanceStopsAtTheQuoteToken() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        ThesisBasket.Leg[] memory legs = new ThesisBasket.Leg[](1);
        legs[0] = ThesisBasket.Leg({
            tokenIn: address(xnvda),
            tokenOut: address(usdt),
            amountIn: 0.5e18,
            minAmountOut: 50 * ONE_USDT
        });

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.QuoteResidue.selector, 50 * ONE_USDT));
        basket.rebalance(legs);
    }

    function test_RevertWhen_RebalanceCallerIsNotAgent() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.NotAgent.selector, alice));
        basket.rebalance(_oneLeg(address(xnvda), address(xamd), 0.5e18, 1e18));
    }

    function test_RevertWhen_RebalanceHasNoLegs() public {
        vm.prank(agent);
        vm.expectRevert(ThesisBasket.NoLegs.selector);
        basket.rebalance(new ThesisBasket.Leg[](0));
    }

    function test_RevertWhen_RebalanceTouchesAnOutsideToken() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        address outsider = address(new MockERC20("Outsider", "OUT", 18));

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.UntradeableToken.selector, outsider));
        basket.rebalance(_oneLeg(address(xnvda), outsider, 0.5e18, 1e18));
    }

    function test_RevertWhen_RebalanceLegHasNoSlippageBound() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.MissingSlippageBound.selector, uint256(0)));
        basket.rebalance(_oneLeg(address(xnvda), address(xamd), 0.5e18, 0));
    }

    function test_RevertWhen_RebalanceLegSwapsATokenForItself() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ThesisBasket.SameToken.selector, address(xnvda)));
        basket.rebalance(_oneLeg(address(xnvda), address(xnvda), 0.5e18, 1e18));
    }

    function test_RebalanceCannotPayTheAgent() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        vm.prank(agent);
        basket.rebalance(_oneLeg(address(xnvda), address(xamd), 0.5e18, 1e18));

        assertEq(xamd.balanceOf(agent), 0, "fills land in the basket, never the caller");
        assertEq(xnvda.balanceOf(agent), 0);
        assertEq(basket.balanceOf(agent), 0);
    }

    /* -------------------------------------------------------------------- nav */

    function test_NavPerShareIsZeroBeforeFirstMint() public view {
        (address[] memory navTokens, uint256[] memory units) = basket.navPerShare();
        assertEq(navTokens.length, 4);
        for (uint256 i; i < units.length; ++i) {
            assertEq(units[i], 0);
        }
    }

    function test_NavPerShareMatchesWhatOneShareRedeemsFor() public {
        _mintFor(alice, 1_000 * ONE_USDT);

        (, uint256[] memory units) = basket.navPerShare();

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(ONE_SHARE);

        for (uint256 i; i < units.length; ++i) {
            assertEq(amounts[i], units[i], "nav per share is the redemption claim");
        }
    }

    function test_NavPerShareRisesWithAppreciation() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        (, uint256[] memory before) = basket.navPerShare();

        xnvda.mint(address(basket), 2.5e18);

        (, uint256[] memory afterUnits) = basket.navPerShare();
        assertEq(afterUnits[0], before[0] * 2);
        assertEq(afterUnits[1], before[1]);
    }

    /* --------------------------------------------------------------- rounding */

    function test_MintAtSmallestUsefulAmount() public {
        uint256 shares = _mintFor(alice, 4);

        assertEq(shares, 4e12, "4 micro-USDT is 4e-6 of a share");
        assertEq(xnvda.balanceOf(address(basket)), Math.mulDiv(1, 1e18, 100 * ONE_USDT));
    }

    function test_RedeemingDustBurnsSharesAndReturnsNothing() public {
        _mintFor(alice, 1_000 * ONE_USDT);
        uint256 supplyBefore = basket.totalSupply();

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(1);

        for (uint256 i; i < amounts.length; ++i) {
            assertEq(amounts[i], 0, "rounds down in the basket's favour");
        }
        assertEq(basket.totalSupply(), supplyBefore - 1);
    }

    function testFuzz_SoleHolderRedeemsEverythingBack(uint256 quoteAmount) public {
        quoteAmount = bound(quoteAmount, 4, 10_000_000 * ONE_USDT);
        _mintFor(alice, quoteAmount);

        uint256[] memory heldBefore = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            heldBefore[i] = IERC20(tokens[i]).balanceOf(address(basket));
        }

        uint256 aliceShares = basket.balanceOf(alice);
        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(aliceShares);

        for (uint256 i; i < tokens.length; ++i) {
            assertEq(amounts[i], heldBefore[i], "sole holder is owed the whole basket");
            assertEq(IERC20(tokens[i]).balanceOf(address(basket)), 0);
        }
    }

    /* ---------------------------------------------------------------- helpers */

    function _price(MockERC20 equity, uint256 usdtPerShare) private {
        router.setRate(address(usdt), address(equity), 1e18, usdtPerShare * ONE_USDT);
    }

    function _fund(address who, uint256 amount) private {
        usdt.mint(who, amount);
    }

    function _mintFor(address who, uint256 quoteAmount) private returns (uint256 shares) {
        _fund(who, quoteAmount);
        vm.startPrank(who);
        usdt.approve(address(basket), quoteAmount);
        shares = basket.mint(quoteAmount, 0);
        vm.stopPrank();
    }

    function _oneLeg(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        private
        pure
        returns (ThesisBasket.Leg[] memory legs)
    {
        legs = new ThesisBasket.Leg[](1);
        legs[0] = ThesisBasket.Leg({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut
        });
    }

    function _deploy(address[] memory constituents_) private returns (ThesisBasket) {
        return new ThesisBasket(
            "n", "s", "t", IERC20(address(usdt)), ITradeRouter(address(router)), agent, constituents_
        );
    }
}
