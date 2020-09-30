pragma solidity ^0.5.12;
import "../KittyMarketplace.sol";

contract TestKittyMarketPlace is KittyMarketPlace {
    constructor(address _kittyContractAddress)
        public
        KittyMarketPlace(_kittyContractAddress)
    {}

    function getKittyContractAddress() public view returns (address addr) {
        return address(_kittyContract);
    }

    function hasActiveOffer(uint256 _tokenId) public view returns(bool) {
        return tokenIdToOffer[_tokenId].active;
    }

    function test_createOffer(
        address payable _seller,
        uint256 _price,
        uint256 _tokenId,
        bool _active
    ) public {
        Offer memory newOffer = Offer(
            _seller,
            _price,
            offers.length,
            _tokenId,
            _active
        );
        offers.push(newOffer);
        tokenIdToOffer[_tokenId] = newOffer;
        emit MarketTransaction("Create offer", msg.sender, _tokenId);
    }
}
