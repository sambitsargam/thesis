// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThesisFactory} from "../src/ThesisFactory.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";

/// @title DeployV2
/// @notice Deploys the V2 factory alongside the V1 one, leaving V1 untouched.
/// @dev V2 baskets pay their creator a capped share of each mint. Nothing else changes,
///      so this reuses the live `OkxTradeRouter` rather than deploying a second adapter:
///      the adapter is stateless and holds no funds between calls. `ThesisZap` also
///      needs no redeploy — it reads `constituents()`, `router()` and `quoteToken()` and
///      calls `redeem()`, all identical in V2, and redeem charges no fee.
///
///      Writes `deployments/<chainId>-v2.json`, a separate file, because the V1 record is
///      referenced by the submission and must stay exactly as judged.
contract DeployV2 is Script {
    /// @notice Deploy the V2 factory.
    /// @return factory Address of the deployed factory.
    function run() external returns (address factory) {
        address quoteToken = vm.envAddress("QUOTE_TOKEN");
        // Required, not optional: V2 is meant to share V1's live adapter.
        address router = vm.envAddress("TRADE_ROUTER");
        address agent = vm.envAddress("AGENT_ADDRESS");

        vm.startBroadcast();
        factory = address(new ThesisFactory(IERC20(quoteToken), ITradeRouter(router), agent));
        vm.stopBroadcast();

        console2.log("chain            ", block.chainid);
        console2.log("ThesisFactory V2 ", factory);
        console2.log("  quoteToken     ", quoteToken);
        console2.log("  router (reused)", router);
        console2.log("  agent          ", agent);

        string memory key = "thesisV2";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "quoteToken", quoteToken);
        vm.serializeAddress(key, "router", router);
        vm.serializeAddress(key, "agent", agent);
        string memory json = vm.serializeAddress(key, "factory", factory);

        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), "-v2.json"));
    }
}
