// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OkxTradeRouter} from "../src/OkxTradeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockDexTokenApprove, MockOkxDexRouter} from "./mocks/MockOkxDex.sol";

/// @notice The adapter treats venue calldata as untrusted. These tests attack it with
///         blobs that underfill, overreach, divert funds, and revert outright.
contract OkxTradeRouterTest is Test {
    uint256 private constant ONE_USDT = 1e6;

    MockERC20 internal usdt;
    MockERC20 internal nvdax;
    MockDexTokenApprove internal tokenApprove;
    MockOkxDexRouter internal dexRouter;
    OkxTradeRouter internal adapter;

    address internal basket = makeAddr("basket");
    address internal thief = makeAddr("thief");

    function setUp() public {
        usdt = new MockERC20("USD-T0", "USDT", 6);
        nvdax = new MockERC20("NVIDIA xStock", "NVDAx", 18);
        tokenApprove = new MockDexTokenApprove();
        dexRouter = new MockOkxDexRouter(tokenApprove);
        adapter = new OkxTradeRouter(address(dexRouter), address(tokenApprove));

        usdt.mint(basket, 10_000 * ONE_USDT);
        vm.prank(basket);
        usdt.approve(address(adapter), type(uint256).max);
    }

    function test_ConstructorStoresBothOkxContracts() public view {
        assertEq(adapter.dexRouter(), address(dexRouter));
        assertEq(adapter.tokenApprove(), address(tokenApprove));
    }

    function test_RevertWhen_ConstructedWithZeroAddress() public {
        vm.expectRevert(OkxTradeRouter.ZeroAddress.selector);
        new OkxTradeRouter(address(0), address(tokenApprove));
    }

    function test_SwapDeliversTheFillToTheRecipient() public {
        bytes memory data = _swapBlob(100 * ONE_USDT, 1e18);

        vm.prank(basket);
        uint256 amountOut =
            adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);

        assertEq(amountOut, 1e18);
        assertEq(nvdax.balanceOf(basket), 1e18);
        assertEq(usdt.balanceOf(basket), 9_900 * ONE_USDT);
    }

    function test_AdapterKeepsNothingAfterASwap() public {
        bytes memory data = _swapBlob(100 * ONE_USDT, 1e18);

        vm.prank(basket);
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);

        assertEq(usdt.balanceOf(address(adapter)), 0, "no quote token left behind");
        assertEq(nvdax.balanceOf(address(adapter)), 0, "no equity left behind");
        assertEq(usdt.allowance(address(adapter), address(tokenApprove)), 0, "approval reset");
    }

    function test_UnspentInputIsRefundedToTheCaller() public {
        // The venue takes only 60 of the 100 it was approved for.
        bytes memory data = abi.encodeCall(
            MockOkxDexRouter.executePartial, (address(usdt), address(nvdax), 60 * ONE_USDT, 1e18)
        );

        vm.prank(basket);
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);

        assertEq(usdt.balanceOf(basket), 9_940 * ONE_USDT, "40 USDT came back");
        assertEq(usdt.balanceOf(address(adapter)), 0);
    }

    function test_RevertWhen_FillIsBelowTheFloor() public {
        bytes memory data = _swapBlob(100 * ONE_USDT, 0.9e18);

        vm.prank(basket);
        vm.expectRevert(abi.encodeWithSelector(OkxTradeRouter.InsufficientOutput.selector, 0.9e18, 1e18));
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);
    }

    function test_RevertWhen_CalldataDivertsTheOutput() public {
        // Takes the USDT and sends the NVDAx to someone else. The adapter measures its
        // own balance, sees nothing arrived, and reverts the whole transaction.
        bytes memory data = abi.encodeCall(
            MockOkxDexRouter.executeStealing, (address(usdt), address(nvdax), 100 * ONE_USDT, thief)
        );

        vm.prank(basket);
        vm.expectRevert(abi.encodeWithSelector(OkxTradeRouter.InsufficientOutput.selector, 0, 1e18));
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);

        assertEq(nvdax.balanceOf(thief), 0, "revert undoes the diversion");
        assertEq(usdt.balanceOf(basket), 10_000 * ONE_USDT, "deposit untouched");
    }

    function test_RevertWhen_VenueCallReverts() public {
        bytes memory data = abi.encodeCall(MockOkxDexRouter.executeFailing, ());

        vm.prank(basket);
        vm.expectRevert();
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, data);
    }

    function test_RevertWhen_SwapDataIsEmpty() public {
        vm.prank(basket);
        vm.expectRevert(OkxTradeRouter.EmptySwapData.selector);
        adapter.swapExactIn(address(usdt), address(nvdax), 100 * ONE_USDT, 1e18, basket, "");
    }

    function test_RevertWhen_TokensAreTheSame() public {
        vm.prank(basket);
        vm.expectRevert(abi.encodeWithSelector(OkxTradeRouter.SameToken.selector, address(usdt)));
        adapter.swapExactIn(address(usdt), address(usdt), 100 * ONE_USDT, 1, basket, hex"01");
    }

    function testFuzz_MeasuredFillIsWhatTheRecipientGets(uint256 amountIn, uint256 amountOut) public {
        amountIn = bound(amountIn, 1, 10_000 * ONE_USDT);
        amountOut = bound(amountOut, 1, 1_000e18);

        bytes memory data = _swapBlob(amountIn, amountOut);

        vm.prank(basket);
        uint256 reported =
            adapter.swapExactIn(address(usdt), address(nvdax), amountIn, amountOut, basket, data);

        assertEq(reported, amountOut);
        assertEq(nvdax.balanceOf(basket), amountOut);
        assertEq(usdt.balanceOf(address(adapter)), 0);
    }

    function _swapBlob(uint256 amountIn, uint256 amountOut) private view returns (bytes memory) {
        return
            abi.encodeCall(MockOkxDexRouter.executeSwap, (address(usdt), address(nvdax), amountIn, amountOut));
    }
}
