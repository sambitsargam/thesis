// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ThesisBasket} from "../src/ThesisBasket.sol";
import {ThesisFactory} from "../src/ThesisFactory.sol";
import {DeployThesis} from "../script/DeployThesis.s.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTradeRouter} from "./mocks/MockTradeRouter.sol";

/// @notice Runs the real deploy script against a local chain so mainnet is not its first run.
contract DeployThesisTest is Test {
    MockERC20 internal usdt;
    MockERC20 internal xnvda;
    MockERC20 internal xamd;
    MockTradeRouter internal router;
    DeployThesis internal script;

    address internal agent = makeAddr("agent");

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        xnvda = new MockERC20("NVIDIA xStock", "XNVDA", 18);
        xamd = new MockERC20("AMD xStock", "XAMD", 18);
        router = new MockTradeRouter();
        script = new DeployThesis();

        vm.setEnv("QUOTE_TOKEN", vm.toString(address(usdt)));
        vm.setEnv("TRADE_ROUTER", vm.toString(address(router)));
        vm.setEnv("AGENT_ADDRESS", vm.toString(agent));
        vm.setEnv("TRADE_ROUTER", vm.toString(address(router)));
        vm.setEnv("OKX_DEX_ROUTER", vm.toString(address(router)));
        vm.setEnv("OKX_TOKEN_APPROVE", vm.toString(address(router)));
    }

    function test_DeploysFactoryWithAndWithoutADemoBasket() public {
        // Both cases share one test: environment variables are process-global, so
        // splitting them lets concurrent tests overwrite each other's configuration.
        vm.setEnv("DEMO_CONSTITUENTS", "");

        (address bareFactory, address noBasket) = script.run();
        assertEq(noBasket, address(0), "no basket without DEMO_CONSTITUENTS");
        assertEq(ThesisFactory(bareFactory).basketCount(), 0);

        vm.setEnv(
            "DEMO_CONSTITUENTS", string.concat(vm.toString(address(xnvda)), ",", vm.toString(address(xamd)))
        );
        vm.setEnv("DEMO_SYMBOL", "THESIS-SEMI");

        (address factoryAddr, address basketAddr) = script.run();

        ThesisFactory factory = ThesisFactory(factoryAddr);
        assertEq(address(factory.quoteToken()), address(usdt));
        assertEq(address(factory.router()), address(router));
        assertEq(factory.agent(), agent);

        assertTrue(factory.isBasket(basketAddr), "demo basket registered");
        assertEq(factory.basketCount(), 1);

        ThesisBasket basket = ThesisBasket(basketAddr);
        assertEq(basket.symbol(), "THESIS-SEMI");
        assertEq(basket.constituentCount(), 2);
        assertEq(basket.agent(), agent);
        assertEq(basket.targetWeightBps(), 5_000);
    }

    function test_WritesDeploymentJson() public {
        script.run();

        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);
        assertEq(vm.parseJsonAddress(json, ".agent"), agent);
        assertEq(vm.parseJsonUint(json, ".chainId"), block.chainid);
    }
}
