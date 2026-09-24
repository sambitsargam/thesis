// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ITradeRouter} from "./interfaces/ITradeRouter.sol";

/// @title ThesisBasket
/// @notice An ERC-20 share of one equal-weight basket of tokenized equities.
/// @dev Fully backed: every share is claimable against real constituent tokens held
///      by this contract. Minting sells the quote token for the constituents in equal
///      parts; redeeming returns the underlying pro rata. No synthetic exposure, no
///      leverage, no oracle. Callers may append an ERC-8021 builder code to the
///      calldata of any function here — trailing bytes are ignored by the decoder.
contract ThesisBasket is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Upper bound on constituents, so mint and redeem stay inside the gas limit.
    uint256 public constant MAX_CONSTITUENTS = 10;

    /// @notice Basis-point denominator for weights.
    uint256 public constant BPS = 10_000;

    /// @notice One whole share, in the basket token's own 18 decimals.
    uint256 public constant ONE_SHARE = 1e18;

    /// @notice Plain-language theme this basket represents.
    string public theme;

    /// @notice Factory that deployed this basket. Holds no funds and has no powers here.
    address public immutable factory;

    /// @notice Token users pay in and that the basket sells to acquire constituents.
    IERC20 public immutable quoteToken;

    /// @notice Venue that fills the basket's swaps.
    ITradeRouter public immutable router;

    /// @dev 10 ** quoteToken.decimals(), used to price the first mint at one share per unit.
    uint256 private immutable _quoteScale;

    /// @notice Address permitted to trigger a rebalance. Cannot move funds out.
    address public immutable agent;

    address[] private _constituents;

    mapping(address token => bool) private _isConstituent;

    /// @notice One swap in a rebalance: sell `amountIn` of `tokenIn` for `tokenOut`.
    /// @dev The agent prices the basket off-chain and submits the legs. This contract
    ///      does not know what equal weight is worth, only that value must stay inside it.
    struct Leg {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes swapData;
    }

    /// @notice Emitted when shares are created against a quote-token deposit.
    event Minted(address indexed account, uint256 quoteAmount, uint256 shares);

    /// @notice Emitted when shares are burned and the underlying is returned in kind.
    event Redeemed(address indexed account, uint256 shares, uint256[] amounts);

    /// @notice Emitted once per rebalance, carrying the fill of every leg.
    event Rebalanced(address indexed caller, uint256[] amountsOut);

    error NoConstituents();
    error TooManyConstituents();
    error InvalidConstituent(address token);
    error DuplicateConstituent(address token);
    error ZeroAmount();
    error ZeroShares();
    error EmptyBasket();
    error SlippageExceeded(uint256 shares, uint256 minSharesOut);
    error NotAgent(address caller);
    error NoLegs();
    error UntradeableToken(address token);
    error SameToken(address token);
    error MissingSlippageBound(uint256 index);
    error QuoteResidue(uint256 amount);
    error SwapDataLengthMismatch(uint256 provided, uint256 expected);

    /// @notice Deploy a basket over a fixed, equal-weight set of constituents.
    /// @param name_ ERC-20 name of the share token.
    /// @param symbol_ ERC-20 symbol of the share token.
    /// @param theme_ Plain-language theme the basket expresses.
    /// @param quoteToken_ Token accepted by `mint`, typically USDT.
    /// @param router_ Venue used to fill mint swaps.
    /// @param agent_ Address allowed to call `rebalance`. Has no other powers.
    /// @param constituents_ Tokenized equities held by the basket. Fixed for its lifetime.
    constructor(
        string memory name_,
        string memory symbol_,
        string memory theme_,
        IERC20 quoteToken_,
        ITradeRouter router_,
        address agent_,
        address[] memory constituents_
    ) ERC20(name_, symbol_) {
        uint256 n = constituents_.length;
        if (n == 0) revert NoConstituents();
        if (n > MAX_CONSTITUENTS) revert TooManyConstituents();
        if (address(quoteToken_) == address(0) || address(router_) == address(0) || agent_ == address(0)) {
            revert InvalidConstituent(address(0));
        }

        for (uint256 i; i < n; ++i) {
            address token = constituents_[i];
            if (token == address(0) || token == address(quoteToken_)) revert InvalidConstituent(token);
            if (_isConstituent[token]) revert DuplicateConstituent(token);
            _isConstituent[token] = true;
            _constituents.push(token);
        }

        agent = agent_;
        factory = msg.sender;
        theme = theme_;
        quoteToken = quoteToken_;
        router = router_;
        _quoteScale = 10 ** IERC20Metadata(address(quoteToken_)).decimals();
    }

    /// @notice Deposit quote tokens, buy the constituents in equal parts, receive shares.
    /// @dev The first mint prices one share per whole quote token. Later mints price
    ///      shares off the scarcest leg actually received, so a bad fill on any single
    ///      constituent dilutes the minter rather than existing holders.
    /// @param quoteAmount Amount of `quoteToken` to spend.
    /// @param minSharesOut Revert if fewer shares than this would be minted.
    /// @param swapData One venue calldata blob per constituent, in `constituents()` order,
    ///        fetched off-chain by the caller. Each must sell exactly this leg's share of
    ///        `quoteAmount` into this contract; the router verifies the result by balance.
    /// @return shares Shares minted to the caller.
    function mint(uint256 quoteAmount, uint256 minSharesOut, bytes[] calldata swapData)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (quoteAmount == 0) revert ZeroAmount();
        uint256 n = _constituents.length;
        if (swapData.length != n) revert SwapDataLengthMismatch(swapData.length, n);

        uint256 supply = totalSupply();
        quoteToken.safeTransferFrom(msg.sender, address(this), quoteAmount);
        quoteToken.forceApprove(address(router), quoteAmount);

        (uint256[] memory held, uint256[] memory received) = _buyConstituents(quoteAmount, swapData);

        quoteToken.forceApprove(address(router), 0);

        shares = _sharesFor(supply, quoteAmount, held, received);
        if (shares == 0) revert ZeroShares();
        if (shares < minSharesOut) revert SlippageExceeded(shares, minSharesOut);

        _mint(msg.sender, shares);
        emit Minted(msg.sender, quoteAmount, shares);
    }

    /// @dev Spends the deposit in equal parts, sending the division dust to the last leg
    ///      so the whole amount is deployed. Returns balances before each swap and the
    ///      amount each one actually delivered.
    function _buyConstituents(uint256 quoteAmount, bytes[] calldata swapData)
        private
        returns (uint256[] memory held, uint256[] memory received)
    {
        uint256 n = _constituents.length;
        held = new uint256[](n);
        received = new uint256[](n);

        uint256 perLeg = quoteAmount / n;
        uint256 spent;

        for (uint256 i; i < n; ++i) {
            uint256 amountIn = i + 1 == n ? quoteAmount - spent : perLeg;
            spent += amountIn;

            (held[i], received[i]) = _buyLeg(_constituents[i], amountIn, swapData[i]);
            if (received[i] == 0) revert ZeroShares();
        }
    }

    /// @dev One leg of a mint, kept in its own frame so the six-argument router call
    ///      does not overflow the stack. Measures the fill rather than trusting it.
    function _buyLeg(address token, uint256 amountIn, bytes calldata swapData)
        private
        returns (uint256 heldBefore, uint256 received)
    {
        heldBefore = IERC20(token).balanceOf(address(this));
        router.swapExactIn(address(quoteToken), token, amountIn, 0, address(this), swapData);
        received = IERC20(token).balanceOf(address(this)) - heldBefore;
    }

    /// @dev Prices the first mint at one share per whole quote token, and every later
    ///      mint off the scarcest leg, so a bad fill dilutes the minter and not the basket.
    function _sharesFor(uint256 supply, uint256 quoteAmount, uint256[] memory held, uint256[] memory received)
        private
        view
        returns (uint256 shares)
    {
        if (supply == 0) return Math.mulDiv(quoteAmount, ONE_SHARE, _quoteScale);

        shares = type(uint256).max;
        for (uint256 i; i < held.length; ++i) {
            if (held[i] == 0) revert EmptyBasket();
            uint256 legShares = Math.mulDiv(supply, received[i], held[i]);
            if (legShares < shares) shares = legShares;
        }
    }

    /// @notice Burn shares and take the underlying constituents out in kind, pro rata.
    /// @dev Needs no router and no price: the claim is a fraction of what is held.
    /// @param shares Shares to burn.
    /// @return amounts Constituent amounts sent to the caller, in `constituents()` order.
    function redeem(uint256 shares) external nonReentrant returns (uint256[] memory amounts) {
        if (shares == 0) revert ZeroAmount();

        uint256 supply = totalSupply();
        if (supply == 0) revert EmptyBasket();

        uint256 n = _constituents.length;
        amounts = new uint256[](n);

        for (uint256 i; i < n; ++i) {
            uint256 held = IERC20(_constituents[i]).balanceOf(address(this));
            amounts[i] = Math.mulDiv(held, shares, supply);
        }

        _burn(msg.sender, shares);

        for (uint256 i; i < n; ++i) {
            if (amounts[i] != 0) IERC20(_constituents[i]).safeTransfer(msg.sender, amounts[i]);
        }

        emit Redeemed(msg.sender, shares, amounts);
    }

    /// @notice Trade the basket back toward equal weight, without value leaving it.
    /// @dev Only the agent may call this, and the agent cannot steal: every fill is
    ///      delivered to this contract, every leg must carry its own floor price, and
    ///      the basket must end fully invested with no quote token left over. Weights
    ///      are computed off-chain because equal weight is a statement about value and
    ///      this contract holds no price feed. Routing through the quote token mid-way
    ///      is allowed; ending the call holding it is not.
    /// @param legs Swaps to perform, in order.
    /// @return amountsOut Amount of `tokenOut` received on each leg.
    function rebalance(Leg[] calldata legs) external nonReentrant returns (uint256[] memory amountsOut) {
        if (msg.sender != agent) revert NotAgent(msg.sender);
        if (legs.length == 0) revert NoLegs();

        amountsOut = new uint256[](legs.length);

        for (uint256 i; i < legs.length; ++i) {
            Leg calldata leg = legs[i];
            if (!_isTradeable(leg.tokenIn)) revert UntradeableToken(leg.tokenIn);
            if (!_isTradeable(leg.tokenOut)) revert UntradeableToken(leg.tokenOut);
            if (leg.tokenIn == leg.tokenOut) revert SameToken(leg.tokenIn);
            if (leg.amountIn == 0) revert ZeroAmount();
            if (leg.minAmountOut == 0) revert MissingSlippageBound(i);

            uint256 held = IERC20(leg.tokenOut).balanceOf(address(this));
            IERC20(leg.tokenIn).forceApprove(address(router), leg.amountIn);
            router.swapExactIn(
                leg.tokenIn, leg.tokenOut, leg.amountIn, leg.minAmountOut, address(this), leg.swapData
            );
            IERC20(leg.tokenIn).forceApprove(address(router), 0);

            amountsOut[i] = IERC20(leg.tokenOut).balanceOf(address(this)) - held;
        }

        uint256 residue = quoteToken.balanceOf(address(this));
        if (residue != 0) revert QuoteResidue(residue);

        emit Rebalanced(msg.sender, amountsOut);
    }

    /// @notice Whether a token is one of the basket's constituents.
    /// @param token Token to check.
    /// @return True if `token` is held as a constituent.
    function isConstituent(address token) external view returns (bool) {
        return _isConstituent[token];
    }

    /// @notice Constituent tokens held by the basket, in mint and redeem order.
    /// @return Addresses of the constituents.
    function constituents() external view returns (address[] memory) {
        return _constituents;
    }

    /// @notice Number of constituents in the basket.
    /// @return Constituent count.
    function constituentCount() external view returns (uint256) {
        return _constituents.length;
    }

    /// @notice Target weight of each constituent, in basis points. Equal weight only.
    /// @return Target weight per constituent.
    function targetWeightBps() external view returns (uint256) {
        return BPS / _constituents.length;
    }

    /// @notice Constituent balances currently backing the basket.
    /// @return tokens Constituent addresses.
    /// @return balances Amount of each held by this contract.
    function constituentBalances()
        external
        view
        returns (address[] memory tokens, uint256[] memory balances)
    {
        uint256 n = _constituents.length;
        tokens = _constituents;
        balances = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }

    /// @notice Net asset value of one share, expressed in kind as constituent units.
    /// @dev Oracle-free: this is exactly what redeeming `ONE_SHARE` would return, up to
    ///      rounding. Pricing it in USDT is a display concern and stays off-chain.
    /// @return tokens Constituent addresses.
    /// @return units Amount of each constituent backing one whole share.
    function navPerShare() external view returns (address[] memory tokens, uint256[] memory units) {
        uint256 n = _constituents.length;
        uint256 supply = totalSupply();
        tokens = _constituents;
        units = new uint256[](n);
        if (supply == 0) return (tokens, units);
        for (uint256 i; i < n; ++i) {
            units[i] = Math.mulDiv(IERC20(tokens[i]).balanceOf(address(this)), ONE_SHARE, supply);
        }
    }

    /// @dev A rebalance may touch constituents and may pass through the quote token.
    function _isTradeable(address token) private view returns (bool) {
        return _isConstituent[token] || token == address(quoteToken);
    }
}
