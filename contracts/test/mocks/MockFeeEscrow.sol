// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Local tests only: a fee escrow with the same read and claim shape as the Pons escrow the site reads
/// (balanceOf(address), claim() returning the amount, Claimed/Credited events, NoBalance()).
contract MockFeeEscrow {
    mapping(address => uint256) public balanceOf;

    event Credited(address indexed recipient, address indexed depositor, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);

    error NoBalance();
    error TransferFailed();

    function credit(address recipient) external payable {
        balanceOf[recipient] += msg.value;
        emit Credited(recipient, msg.sender, msg.value);
    }

    function claim() external returns (uint256 amount) {
        amount = balanceOf[msg.sender];
        if (amount == 0) revert NoBalance();
        balanceOf[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(msg.sender, amount);
    }
}
