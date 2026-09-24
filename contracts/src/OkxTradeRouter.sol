// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITradeRouter} from "./interfaces/ITradeRouter.sol";

/// @title OkxTradeRouter
/// @notice Routes basket swaps through Onchain OS Trade on X Layer.
/// @dev Onchain OS Trade is quoted off-chain: the caller fetches calldata from the
///      aggregator API and passes it in as `swapData`. This contract forwards that blob
///      to the OKX DexRouter and then decides for itself whether the swap was acceptable,
///      by measuring balances before and after. The blob is never trusted.
///
///      Two OKX contracts are involved, and confusing them silently breaks every swap:
///      tokens are approved to `tokenApprove`, while the call itself goes to `dexRouter`.
///
///      This contract is stateless between calls and is never meant to hold a balance.
///      Anything a venue leaves behind is swept back to the caller in the same
///      transaction, so a stuck approval cannot be drained by a later caller.
contract OkxTradeRouter is ITradeRouter {
    using SafeERC20 for IERC20;

    /// @notice OKX aggregation router that executes the swap calldata.
    address public immutable dexRouter;

    /// @notice OKX contract that pulls tokens. Approvals go here, not to `dexRouter`.
    address public immutable tokenApprove;

    /// @notice Emitted on every fill, with the amount measured rather than reported.
    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    error ZeroAddress();
    error EmptySwapData();
    error SameToken(address token);
    error SwapFailed(bytes reason);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);

    /// @notice Bind the adapter to the OKX contracts for this chain.
    /// @param dexRouter_ OKX DexRouter, `0x7c5bee2a8091c3ef39072f64f18fac913060aeaf` on X Layer.
    /// @param tokenApprove_ OKX DexTokenApprove, `0x8b773D83bc66Be128c60e07E17C8901f7a64F000` on X Layer.
    constructor(address dexRouter_, address tokenApprove_) {
        if (dexRouter_ == address(0) || tokenApprove_ == address(0)) revert ZeroAddress();
        dexRouter = dexRouter_;
        tokenApprove = tokenApprove_;
    }

    /// @inheritdoc ITradeRouter
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata swapData
    ) external returns (uint256 amountOut) {
        if (swapData.length == 0) revert EmptySwapData();
        if (tokenIn == tokenOut) revert SameToken(tokenIn);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));

        // Approve the pulling contract, never the router, and only for this one swap.
        IERC20(tokenIn).forceApprove(tokenApprove, amountIn);
        (bool ok, bytes memory reason) = dexRouter.call(swapData);
        IERC20(tokenIn).forceApprove(tokenApprove, 0);
        if (!ok) revert SwapFailed(reason);

        // The fill is whatever actually arrived, not whatever the calldata promised.
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - outBefore;
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        uint256 unspent = IERC20(tokenIn).balanceOf(address(this));
        if (unspent != 0) IERC20(tokenIn).safeTransfer(msg.sender, unspent);

        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit Swapped(tokenIn, tokenOut, amountIn, amountOut);
    }
}
