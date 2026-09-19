// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITradeRouter
/// @notice Adapter boundary between a basket and whatever venue fills its swaps.
/// @dev This interface is defined by Thesis, not by OKX. Step 7 supplies an
///      implementation backed by Onchain OS Trade; tests supply a mock. The basket
///      never learns which is which, so routing can change without touching
///      `ThesisBasket`.
interface ITradeRouter {
    /// @notice Swap an exact amount of `tokenIn` for as much `tokenOut` as the venue gives.
    /// @dev The caller must have approved `amountIn` of `tokenIn` to this router.
    ///      Implementations must revert if the fill is worse than `minAmountOut`.
    /// @param tokenIn Token being sold.
    /// @param tokenOut Token being bought.
    /// @param amountIn Exact amount of `tokenIn` to sell.
    /// @param minAmountOut Minimum acceptable amount of `tokenOut`.
    /// @param recipient Address credited with `tokenOut`.
    /// @return amountOut Amount of `tokenOut` delivered to `recipient`.
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
