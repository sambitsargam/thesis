// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITradeRouter
/// @notice Adapter boundary between a basket and whatever venue fills its swaps.
/// @dev This interface is defined by Thesis, not by OKX. Onchain OS Trade quotes
///      off-chain and returns ready-made calldata, so a basket cannot ask a venue for a
///      price mid-transaction. `swapData` carries that pre-built calldata in from the
///      caller. Implementations must treat it as untrusted: enforce `minAmountOut`
///      against a measured balance delta, never against anything the blob claims.
interface ITradeRouter {
    /// @notice Swap an exact amount of `tokenIn` for at least `minAmountOut` of `tokenOut`.
    /// @dev The caller must have approved `amountIn` of `tokenIn` to this router.
    ///      Implementations must refund any `tokenIn` the venue did not spend.
    /// @param tokenIn Token being sold.
    /// @param tokenOut Token being bought.
    /// @param amountIn Exact amount of `tokenIn` to sell.
    /// @param minAmountOut Minimum acceptable amount of `tokenOut`.
    /// @param recipient Address credited with `tokenOut`.
    /// @param swapData Venue calldata obtained off-chain. Opaque and untrusted.
    /// @return amountOut Amount of `tokenOut` delivered to `recipient`.
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata swapData
    ) external returns (uint256 amountOut);
}
