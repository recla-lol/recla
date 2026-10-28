// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReclaSourceRegistry} from "../../src/ReclaSourceRegistry.sol";

interface IFeeEscrow {
    function balanceOf(address recipient) external view returns (uint256);
}

interface ILocker {
    function nextLockId() external view returns (uint256);
}

/// Fork test against Robinhood Chain mainnet: the registry deploys on real chain state, accepts the real Pons fee
/// escrow and HoodLock locker as sources, and its block reads give the chain's own (L2) block numbers.
///   forge test --match-path 'test/fork/*' --fork-url https://rpc.mainnet.chain.robinhood.com --evm-version cancun
contract ReclaForkTest is Test {
    address constant PONS_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address constant LOCKER = 0xD0f7d8c6e9f6D80c297bEbe4F7fD1B9C8125C32F;

    function setUp() public {
        vm.skip(block.chainid != 4663);
    }

    function test_fork_registersRealSources() public {
        ReclaSourceRegistry reg = new ReclaSourceRegistry();
        uint256 a = reg.register(PONS_ESCROW, 4, "https://ponsfamily.com", keccak256("pons escrow"), "Pons creator fee escrow");
        uint256 b = reg.register(LOCKER, 2, "https://hoodlock.tech", keccak256("hoodlock"), "HoodLock token locks");
        vm.prank(address(0xB0B));
        reg.attest(a);
        assertEq(reg.getEntry(a).attestCount, 1);
        assertEq(reg.getEntry(b).kind, 2);
        assertGt(reg.getEntry(a).registeredBlock, 90_000_000);
        // The adapters' read paths answer on the real contracts.
        IFeeEscrow(PONS_ESCROW).balanceOf(address(this));
        assertGt(ILocker(LOCKER).nextLockId(), 0);
    }

    function test_fork_chainBlockIsTheL2Block() public {
        ReclaSourceRegistry reg = new ReclaSourceRegistry();
        assertEq(reg.chainBlock(), uint64(block.number));
        assertGt(block.number, 90_000_000);
    }
}
