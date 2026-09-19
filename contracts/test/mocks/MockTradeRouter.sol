// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ITradeRouter} from "../../src/interfaces/ITradeRouter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Deep-liquidity router stub: takes `tokenIn`, mints `tokenOut` at a fixed rate.
/// @dev Rates are set per pair as a numerator/denominator so decimal mismatches between
///      a 6-decimal quote token and an 18-decimal equity are explicit in the test.
contract MockTradeRouter is ITradeRouter {
    using SafeERC20 for IERC20;

    mapping(address tokenIn => mapping(address tokenOut => uint256)) public rateNum;
    mapping(address tokenIn => mapping(address tokenOut => uint256)) public rateDen;

    error NoRate(address tokenIn, address tokenOut);
    error MockSlippage(uint256 amountOut, uint256 minAmountOut);

    /// @notice Price `tokenOut` against `tokenIn`: amountOut = amountIn * num / den.
    function setRate(address tokenIn, address tokenOut, uint256 num, uint256 den) external {
        rateNum[tokenIn][tokenOut] = num;
        rateDen[tokenIn][tokenOut] = den;
    }

    /// @inheritdoc ITradeRouter
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        uint256 den = rateDen[tokenIn][tokenOut];
        if (den == 0) revert NoRate(tokenIn, tokenOut);

        amountOut = Math.mulDiv(amountIn, rateNum[tokenIn][tokenOut], den);
        if (amountOut < minAmountOut) revert MockSlippage(amountOut, minAmountOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(recipient, amountOut);
    }
}
