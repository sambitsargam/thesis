// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ThesisZap} from "../src/ThesisZap.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";

/// @title DeployZap
/// @notice Deploys the sell-to-quote helper against an existing router.
/// @dev Separate from `DeployThesis` so it can be added to a live deployment without
///      redeploying the factory or any basket. Reads `TRADE_ROUTER`, which must be the
///      same adapter the baskets were deployed with.
contract DeployZap is Script {
    function run() external returns (address zap) {
        address router = vm.envAddress("TRADE_ROUTER");

        vm.startBroadcast();
        zap = address(new ThesisZap(ITradeRouter(router)));
        vm.stopBroadcast();

        console2.log("chain       ", block.chainid);
        console2.log("ThesisZap   ", zap);
        console2.log("  router    ", router);
    }
}
