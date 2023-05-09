// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// providing optional methods (name, symbol and decimals)
contract DummyUSDC is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint128 _initialSupply
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }

    function mint(address _recipient, uint128 _amount) public {
        _mint(_recipient, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
