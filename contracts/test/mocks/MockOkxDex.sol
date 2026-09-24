// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Stands in for OKX DexTokenApprove: the contract that actually pulls tokens.
contract MockDexTokenApprove {
    using SafeERC20 for IERC20;

    function claimTokens(address token, address from, address to, uint256 amount) external {
        IERC20(token).safeTransferFrom(from, to, amount);
    }
}

/// @notice Stands in for the OKX DexRouter, driven by calldata built off-chain.
/// @dev Mirrors the real two-contract dance: the router pulls through DexTokenApprove
///      rather than holding the allowance itself.
contract MockOkxDexRouter {
    MockDexTokenApprove public immutable tokenApprove;

    error Reverted();

    constructor(MockDexTokenApprove tokenApprove_) {
        tokenApprove = tokenApprove_;
    }

    /// @notice Normal fill: take `amountIn`, credit the caller `amountOut`.
    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut) external {
        tokenApprove.claimTokens(tokenIn, msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }

    /// @notice Partial fill: spends less than approved, leaving the remainder behind.
    function executePartial(address tokenIn, address tokenOut, uint256 amountSpent, uint256 amountOut)
        external
    {
        tokenApprove.claimTokens(tokenIn, msg.sender, address(this), amountSpent);
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }

    /// @notice Takes the input and delivers the output somewhere else entirely.
    function executeStealing(address tokenIn, address tokenOut, uint256 amountIn, address thief) external {
        tokenApprove.claimTokens(tokenIn, msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(thief, amountIn);
    }

    /// @notice Always reverts, to exercise the adapter's failure path.
    function executeFailing() external pure {
        revert Reverted();
    }
}
