pragma solidity ^0.5.12;
import "../Kittycontract.sol";

contract TestKittyContract is Kittycontract {
    event Test(uint256 message);

    function setKittyToOwner(uint256 _kittyId, address _address) public {
        kittyIndexToOwner[_kittyId] = _address;
    }

    function setOwnerKittyCount(address _address, uint256 _count) public {
        ownershipTokenCount[_address] = _count;
    }

    function addKitty(
        uint256 _mumId,
        uint256 _dadId,
        uint256 _generation,
        uint256 _genes,
        address _owner
    ) public {
        Kitty memory newKitty = Kitty({
            genes: _genes,
            birthTime: uint64(now),
            mumId: uint32(_mumId),
            dadId: uint32(_dadId),
            generation: uint16(_generation)
        });
        uint256 id = kitties.push(newKitty) - 1;
        kittyIndexToOwner[id] = _owner;
        ownershipTokenCount[_owner] += 1;
    }

    function createKitty(
        uint256 _mumId,
        uint256 _dadId,
        uint256 _generation,
        uint256 _genes,
        address _owner
    ) public returns (uint256) {
        _createKitty(_mumId, _dadId, _generation, _genes, _owner);
    }

    function mixDna(
        uint256 _dadDna,
        uint256 _mumDna
    ) public pure returns (uint256) {
        return _mixDna(_dadDna, _mumDna);
    }
}
