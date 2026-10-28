// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReclaSourceRegistry} from "../src/ReclaSourceRegistry.sol";

contract Target {
    function ping() external pure returns (uint256) {
        return 1;
    }
}

/// Random registrations, attestations and flags from a small set of wallets.
contract RegistryHandler is Test {
    ReclaSourceRegistry public reg;
    address[] public sources;
    address[5] public wallets = [address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0x1005)];
    mapping(uint256 => uint256) public ghostAttest;
    mapping(uint256 => uint256) public ghostFlag;
    mapping(uint256 => mapping(address => bool)) public responded;
    uint256 public ghostEntries;

    constructor(ReclaSourceRegistry r) {
        reg = r;
        for (uint256 i = 0; i < 3; i++) sources.push(address(new Target()));
    }

    function register(uint256 w, uint256 s, uint8 kind) external {
        address who = wallets[w % 5];
        address src = sources[s % 3];
        if (reg.entryIdOf(who, src) != 0) return;
        vm.prank(who);
        reg.register(src, uint8(1 + (kind % 5)), "https://example.org/rules", keccak256("r"), "Handler");
        ghostEntries++;
    }

    function attest(uint256 w, uint256 id) external {
        if (ghostEntries == 0) return;
        id = 1 + (id % ghostEntries);
        address who = wallets[w % 5];
        if (responded[id][who] || reg.getEntry(id).registrant == who) return;
        vm.prank(who);
        reg.attest(id);
        responded[id][who] = true;
        ghostAttest[id]++;
    }

    function flag(uint256 w, uint256 id, uint8 reason) external {
        if (ghostEntries == 0) return;
        id = 1 + (id % ghostEntries);
        address who = wallets[w % 5];
        if (responded[id][who] || reg.getEntry(id).registrant == who) return;
        vm.prank(who);
        reg.flag(id, uint8(1 + (reason % 5)));
        responded[id][who] = true;
        ghostFlag[id]++;
    }
}

contract ReclaSourceRegistryInvariantTest is Test {
    ReclaSourceRegistry reg;
    RegistryHandler h;

    function setUp() public {
        reg = new ReclaSourceRegistry();
        h = new RegistryHandler(reg);
        targetContract(address(h));
    }

    /// Counts on every entry equal the responses the handler made, and no entry ever exceeds 4 responders
    /// (5 wallets minus the registrant).
    function invariant_countsMatch() public view {
        uint256 n = reg.entryCount();
        assertEq(n, h.ghostEntries());
        uint256 a;
        uint256 f;
        for (uint256 id = 1; id <= n; id++) {
            ReclaSourceRegistry.EntryView memory v = reg.getEntry(id);
            assertEq(v.attestCount, h.ghostAttest(id));
            assertEq(v.flagCount, h.ghostFlag(id));
            assertLe(uint256(v.attestCount) + v.flagCount, 4);
            a += v.attestCount;
            f += v.flagCount;
        }
        assertEq(reg.attestTotal(), a);
        assertEq(reg.flagTotal(), f);
    }

    /// The registry never holds ETH.
    function invariant_noFunds() public view {
        assertEq(address(reg).balance, 0);
    }

    /// At most one entry per wallet per source: 5 wallets x 3 sources.
    function invariant_onePerWalletPerSource() public view {
        assertLe(reg.entryCount(), 15);
    }
}
