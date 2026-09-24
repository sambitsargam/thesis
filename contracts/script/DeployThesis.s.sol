// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThesisBasket} from "../src/ThesisBasket.sol";
import {ThesisFactory} from "../src/ThesisFactory.sol";
import {ITradeRouter} from "../src/interfaces/ITradeRouter.sol";
import {OkxTradeRouter} from "../src/OkxTradeRouter.sol";

/// @title DeployThesis
/// @notice Deploys the factory and, optionally, one demo basket.
/// @dev Every address is read from the environment. Nothing is hardcoded, because a
///      wrong constituent baked into a script is a wrong basket deployed to mainnet.
///      Writes `deployments/<chainId>.json` for the shared package to import.
contract DeployThesis is Script {
    struct Config {
        address quoteToken;
        address router;
        address dexRouter;
        address tokenApprove;
        address agent;
        string name;
        string symbol;
        string theme;
        address[] constituents;
    }

    /// @notice Deploy the factory, then a demo basket when constituents are configured.
    /// @return factory Address of the deployed factory.
    /// @return basket Address of the demo basket, or zero when none was requested.
    function run() external returns (address factory, address basket) {
        Config memory cfg = _config();

        vm.startBroadcast();
        if (cfg.router == address(0)) {
            // No adapter supplied: deploy one bound to this chain's OKX contracts.
            cfg.router = address(new OkxTradeRouter(cfg.dexRouter, cfg.tokenApprove));
        }
        factory = address(new ThesisFactory(IERC20(cfg.quoteToken), ITradeRouter(cfg.router), cfg.agent));
        if (cfg.constituents.length != 0) {
            basket = ThesisFactory(factory).createBasket(cfg.name, cfg.symbol, cfg.theme, cfg.constituents);
        }
        vm.stopBroadcast();

        _report(cfg, factory, basket);
        _write(cfg, factory, basket);
    }

    /// @dev Reads deployment inputs from the environment, failing loudly if any are absent.
    function _config() private view returns (Config memory cfg) {
        cfg.quoteToken = vm.envAddress("QUOTE_TOKEN");
        // Optional: supply TRADE_ROUTER to reuse an adapter, or leave it empty to deploy one.
        cfg.router = vm.envOr("TRADE_ROUTER", address(0));
        cfg.dexRouter = vm.envAddress("OKX_DEX_ROUTER");
        cfg.tokenApprove = vm.envAddress("OKX_TOKEN_APPROVE");
        cfg.agent = vm.envAddress("AGENT_ADDRESS");
        cfg.name = vm.envOr("DEMO_NAME", string("Thesis Semiconductors"));
        cfg.symbol = vm.envOr("DEMO_SYMBOL", string("THESIS-SEMI"));
        cfg.theme = vm.envOr("DEMO_THEME", string("semiconductor supply chain, equal weight"));
        // An empty or absent DEMO_CONSTITUENTS means "factory only", not a parse error.
        string memory raw = vm.envOr("DEMO_CONSTITUENTS", string(""));
        cfg.constituents = bytes(raw).length == 0 ? new address[](0) : vm.envAddress("DEMO_CONSTITUENTS", ",");
    }

    function _report(Config memory cfg, address factory, address basket) private view {
        console2.log("chain            ", block.chainid);
        console2.log("ThesisFactory    ", factory);
        console2.log("  quoteToken     ", cfg.quoteToken);
        console2.log("OkxTradeRouter   ", cfg.router);
        console2.log("  dexRouter      ", cfg.dexRouter);
        console2.log("  tokenApprove   ", cfg.tokenApprove);
        console2.log("  agent          ", cfg.agent);
        if (basket == address(0)) {
            console2.log("demo basket       skipped (set DEMO_CONSTITUENTS to deploy one)");
            return;
        }
        console2.log("demo basket      ", basket);
        console2.log("  symbol         ", cfg.symbol);
        for (uint256 i; i < cfg.constituents.length; ++i) {
            console2.log("  constituent    ", cfg.constituents[i]);
        }
    }

    /// @dev One JSON per chain, so `shared/` can import addresses without an indexer.
    function _write(Config memory cfg, address factory, address basket) private {
        string memory key = "thesis";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "quoteToken", cfg.quoteToken);
        vm.serializeAddress(key, "router", cfg.router);
        vm.serializeAddress(key, "okxDexRouter", cfg.dexRouter);
        vm.serializeAddress(key, "okxTokenApprove", cfg.tokenApprove);
        vm.serializeAddress(key, "agent", cfg.agent);
        vm.serializeAddress(key, "demoBasket", basket);
        string memory json = vm.serializeAddress(key, "factory", factory);

        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
