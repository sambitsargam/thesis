// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ThesisBasket} from "./ThesisBasket.sol";
import {ITradeRouter} from "./interfaces/ITradeRouter.sol";

/// @title ThesisZap
/// @notice Sells a basket back to the quote token in one transaction.
/// @dev Baskets redeem in kind by design: burning shares returns the constituent
///      equities, which needs no price and cannot fail on slippage. Holders who want
///      cash instead would otherwise redeem and then sell each leg themselves.
///
///      This peripheral contract does both in one call. It is deliberately separate
///      from `ThesisBasket`: baskets are already deployed and immutable, and keeping
///      the optional path outside them means a basket can never be blocked by a
///      routing failure here.
///
///      Holds no funds between calls. Anything a swap leaves behind is returned to the
///      caller in the same transaction, so nothing accumulates for a later caller to take.
contract ThesisZap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Venue used to sell constituents. Must match the basket's own router.
    ITradeRouter public immutable router;

    /// @notice Emitted when shares are sold back to the quote token.
    event SoldForQuote(address indexed account, address indexed basket, uint256 shares, uint256 quoteOut);

    error ZeroAddress();
    error ZeroAmount();
    error SwapDataLengthMismatch(uint256 provided, uint256 expected);
    error RouterMismatch(address basketRouter, address zapRouter);
    error InsufficientQuoteOut(uint256 quoteOut, uint256 minQuoteOut);

    /// @param router_ Venue that fills the sell legs.
    constructor(ITradeRouter router_) {
        if (address(router_) == address(0)) revert ZeroAddress();
        router = router_;
    }

    /// @notice Burn basket shares and receive the quote token instead of the underlying.
    /// @dev The caller must approve `shares` of `basket` to this contract first. Each
    ///      leg's calldata is fetched off-chain, so the caller controls the route; this
    ///      contract only enforces that enough quote token actually arrives.
    /// @param basket Basket to sell.
    /// @param shares Shares to burn.
    /// @param swapData One venue calldata blob per constituent, in `constituents()` order.
    /// @param minQuoteOut Revert if less quote token than this would be returned.
    /// @return quoteOut Quote tokens sent to the caller.
    function sellForQuote(ThesisBasket basket, uint256 shares, bytes[] calldata swapData, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (shares == 0) revert ZeroAmount();

        address[] memory constituents = basket.constituents();
        if (swapData.length != constituents.length) {
            revert SwapDataLengthMismatch(swapData.length, constituents.length);
        }
        if (address(basket.router()) != address(router)) {
            revert RouterMismatch(address(basket.router()), address(router));
        }

        IERC20 quoteToken = basket.quoteToken();
        uint256 quoteBefore = quoteToken.balanceOf(address(this));

        IERC20(address(basket)).safeTransferFrom(msg.sender, address(this), shares);
        uint256[] memory amounts = basket.redeem(shares);

        for (uint256 i; i < constituents.length; ++i) {
            if (amounts[i] == 0) continue;
            _sellLeg(constituents[i], address(quoteToken), amounts[i], swapData[i]);
        }

        quoteOut = quoteToken.balanceOf(address(this)) - quoteBefore;
        if (quoteOut < minQuoteOut) revert InsufficientQuoteOut(quoteOut, minQuoteOut);

        quoteToken.safeTransfer(msg.sender, quoteOut);

        // Anything a route declined to take goes back in kind rather than being stranded.
        for (uint256 i; i < constituents.length; ++i) {
            uint256 left = IERC20(constituents[i]).balanceOf(address(this));
            if (left != 0) IERC20(constituents[i]).safeTransfer(msg.sender, left);
        }

        emit SoldForQuote(msg.sender, address(basket), shares, quoteOut);
    }

    /// @dev One sell leg, in its own frame so the six-argument router call fits the stack.
    function _sellLeg(address token, address quote, uint256 amountIn, bytes calldata swapData) private {
        IERC20(token).forceApprove(address(router), amountIn);
        router.swapExactIn(token, quote, amountIn, 0, address(this), swapData);
        IERC20(token).forceApprove(address(router), 0);
    }
}
