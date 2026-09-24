// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThesisBasket} from "./ThesisBasket.sol";
import {ITradeRouter} from "./interfaces/ITradeRouter.sol";

/// @title ThesisFactory
/// @notice Permissionless launchpad for equal-weight baskets of tokenized equities.
/// @dev Deploys `ThesisBasket` instances and keeps the registry the agent and the web
///      app read from. Holds no funds and has no owner: it cannot pause a basket, move
///      its assets, or change its constituents after deployment. Anyone may call
///      `createBasket`. Callers may append an ERC-8021 builder code to the calldata.
contract ThesisFactory {
    /// @notice Token every basket from this factory accepts on mint.
    IERC20 public immutable quoteToken;

    /// @notice Venue every basket from this factory routes its swaps through.
    ITradeRouter public immutable router;

    /// @notice Agent permitted to rebalance every basket from this factory.
    address public immutable agent;

    /// @notice True for addresses this factory deployed.
    mapping(address basket => bool) public isBasket;

    /// @notice Who called `createBasket` for a given basket. Confers no powers.
    mapping(address basket => address creator) public creatorOf;

    address[] private _baskets;
    mapping(address creator => address[] baskets) private _createdBy;

    /// @notice Emitted once per deployed basket. The registry's source of truth.
    event BasketCreated(
        address indexed basket,
        address indexed creator,
        uint256 indexed index,
        string name,
        string symbol,
        string theme,
        address[] constituents
    );

    error ZeroAddress();

    /// @notice Fix the quote token, venue and agent shared by every basket deployed here.
    /// @param quoteToken_ Token accepted on mint, typically USDT.
    /// @param router_ Venue used to fill basket swaps.
    /// @param agent_ Address allowed to rebalance the baskets this factory deploys.
    constructor(IERC20 quoteToken_, ITradeRouter router_, address agent_) {
        if (address(quoteToken_) == address(0) || address(router_) == address(0) || agent_ == address(0)) {
            revert ZeroAddress();
        }
        quoteToken = quoteToken_;
        router = router_;
        agent = agent_;
    }

    /// @notice Deploy a basket for a theme. Open to anyone; the caller gains no control.
    /// @dev Constituent validation lives in the basket's constructor, so a bad set
    ///      reverts the whole call and nothing is registered.
    /// @param name_ ERC-20 name of the basket's share token.
    /// @param symbol_ ERC-20 symbol of the basket's share token.
    /// @param theme_ Plain-language theme the basket expresses.
    /// @param constituents_ Tokenized equities to hold at equal weight.
    /// @return basket Address of the newly deployed basket.
    function createBasket(
        string calldata name_,
        string calldata symbol_,
        string calldata theme_,
        address[] calldata constituents_
    ) external returns (address basket) {
        basket = address(new ThesisBasket(name_, symbol_, theme_, quoteToken, router, agent, constituents_));

        uint256 index = _baskets.length;
        isBasket[basket] = true;
        creatorOf[basket] = msg.sender;
        _baskets.push(basket);
        _createdBy[msg.sender].push(basket);

        emit BasketCreated(basket, msg.sender, index, name_, symbol_, theme_, constituents_);
    }

    /// @notice Every basket this factory has deployed, in creation order.
    /// @return Basket addresses.
    function baskets() external view returns (address[] memory) {
        return _baskets;
    }

    /// @notice Number of baskets deployed by this factory.
    /// @return Basket count.
    function basketCount() external view returns (uint256) {
        return _baskets.length;
    }

    /// @notice Basket at a position in the registry.
    /// @param index Position in creation order.
    /// @return Basket address.
    function basketAt(uint256 index) external view returns (address) {
        return _baskets[index];
    }

    /// @notice Baskets deployed by one creator, in creation order.
    /// @param creator Address that called `createBasket`.
    /// @return Basket addresses.
    function basketsOf(address creator) external view returns (address[] memory) {
        return _createdBy[creator];
    }
}
