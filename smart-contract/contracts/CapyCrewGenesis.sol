// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Fixed-supply ERC-721A with one-transaction public minting.
///
/// Metadata files are pre-shuffled off-chain before they are uploaded to IPFS.
/// Token IDs are minted sequentially. After minting closes, the permissionless
/// reveal switches from hidden.json to that fixed sequence.
contract CapyCrewGenesis is ERC721A, ERC2981, Ownable2Step, Pausable, ReentrancyGuard {
    using Strings for uint256;

    error InvalidQuantity();
    error InvalidPrice();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error PublicMintDisabled();
    error MintingClosed();
    error MintingNotClosed();
    error IncorrectPayment();
    error WithdrawFailed();
    error ZeroAddress();
    error MetadataAlreadyRevealed();
    error MetadataNotRevealed();
    error OwnershipRenunciationDisabled();

    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public constant ROYALTY_BPS = 500;

    uint256 public constant maxSupply = MAX_SUPPLY;
    uint256 public constant maxPerWallet = MAX_PER_WALLET;

    uint256 public mintPrice;
    bool public publicMintEnabled;
    bool public mintingClosed;
    bool public metadataRevealed;
    string private baseTokenURI;
    string private unrevealedTokenURI;
    mapping(address => uint256) public mintedByWallet;

    event PublicMintStatusChanged(bool enabled);
    event MintPriceChanged(uint256 price);
    event Minted(address indexed account, uint256 quantity, uint256 totalCost);
    event MintingClosedEvent(uint256 indexed totalSupply);
    event MetadataRevealed();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintPrice_,
        string memory baseTokenURI_,
        string memory unrevealedTokenURI_
    ) ERC721A(name_, symbol_) Ownable(msg.sender) {
        if (mintPrice_ == 0) revert InvalidPrice();
        mintPrice = mintPrice_;
        baseTokenURI = baseTokenURI_;
        unrevealedTokenURI = unrevealedTokenURI_;
        _setDefaultRoyalty(msg.sender, uint96(ROYALTY_BPS));
    }

    /// @notice Mints sequential token IDs in one payable transaction.
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (!publicMintEnabled) revert PublicMintDisabled();
        if (mintingClosed) revert MintingClosed();

        uint256 totalCost = _validatePublicMint(msg.sender, quantity);
        if (msg.value != totalCost) revert IncorrectPayment();

        mintedByWallet[msg.sender] += quantity;
        _safeMint(msg.sender, quantity);
        emit Minted(msg.sender, quantity, totalCost);

        if (totalSupply() == MAX_SUPPLY) _closeMinting();
    }

    /// @notice Owner allocations do not consume the public wallet allowance.
    function ownerMint(address to, uint256 quantity) external onlyOwner nonReentrant whenNotPaused {
        if (mintingClosed) revert MintingClosed();
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply() + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        _safeMint(to, quantity);
        if (totalSupply() == MAX_SUPPLY) _closeMinting();
    }

    /// @notice Closes new minting before sellout, for a fixed sale deadline.
    function closeMinting() external onlyOwner {
        if (!mintingClosed) _closeMinting();
    }

    /// @notice Permissionless collection-level reveal after minting is closed.
    function revealMetadata() external {
        if (!mintingClosed) revert MintingNotClosed();
        if (metadataRevealed) revert MetadataAlreadyRevealed();
        metadataRevealed = true;
        emit MetadataRevealed();
    }

    function setPublicMintEnabled(bool enabled) external onlyOwner {
        if (mintingClosed && enabled) revert MintingClosed();
        publicMintEnabled = enabled;
        emit PublicMintStatusChanged(enabled);
    }

    function setMintPrice(uint256 price) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        mintPrice = price;
        emit MintPriceChanged(price);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        if (!metadataRevealed) return unrevealedTokenURI;
        return string.concat(baseTokenURI, tokenId.toString(), ".json");
    }

    function contractURI() external view returns (string memory) {
        return string.concat(baseTokenURI, "contract.json");
    }

    function totalMinted() external view returns (uint256) {
        return totalSupply();
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        (bool ok,) = payable(owner()).call{value: balance}("");
        if (!ok) revert WithdrawFailed();
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function _validatePublicMint(address account, uint256 quantity) internal view returns (uint256 totalCost) {
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidQuantity();
        if (totalSupply() + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedByWallet[account] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();
        return mintPrice * quantity;
    }

    function _closeMinting() internal {
        mintingClosed = true;
        publicMintEnabled = false;
        emit PublicMintStatusChanged(false);
        emit MintingClosedEvent(totalSupply());
    }

    function _startTokenId() internal pure override returns (uint256) { return 1; }

    function _transferOwnership(address newOwner) internal override {
        super._transferOwnership(newOwner);
        if (newOwner == address(0)) _deleteDefaultRoyalty();
        else _setDefaultRoyalty(newOwner, uint96(ROYALTY_BPS));
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721A, ERC2981) returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}


