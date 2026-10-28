// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReclaSourceRegistry} from "../src/ReclaSourceRegistry.sol";

contract Dummy {
    function ping() external pure returns (uint256) {
        return 1;
    }
}

contract ReclaSourceRegistryTest is Test {
    ReclaSourceRegistry reg;
    address src;
    address src2;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    bytes32 constant H = keccak256("rules v1");

    event SourceRegistered(
        uint256 indexed id, address indexed source, address indexed registrant, uint8 kind, bytes32 rulesHash, string rulesUrl, string label, uint64 chainBlock
    );
    event Attested(uint256 indexed id, address indexed wallet, uint32 attestCount, uint64 chainBlock);
    event Flagged(uint256 indexed id, address indexed wallet, uint8 reason, uint32 flagCount, uint64 chainBlock);

    function setUp() public {
        reg = new ReclaSourceRegistry();
        src = address(new Dummy());
        src2 = address(new Dummy());
    }

    function _reg(address who, address source) internal returns (uint256) {
        vm.prank(who);
        return reg.register(source, 1, "https://example.org/rules", H, "Example drop");
    }

    // ---------------------------------------------------------------- register

    function test_register_storesEntry() public {
        vm.roll(42);
        vm.warp(1000);
        uint256 id = _reg(alice, src);
        assertEq(id, 1);
        assertEq(reg.entryCount(), 1);
        ReclaSourceRegistry.EntryView memory v = reg.getEntry(1);
        assertEq(v.id, 1);
        assertEq(v.source, src);
        assertEq(v.kind, 1);
        assertEq(v.registrant, alice);
        assertEq(v.registeredBlock, 42);
        assertEq(v.registeredAt, 1000);
        assertEq(v.rulesHash, H);
        assertEq(v.rulesUrl, "https://example.org/rules");
        assertEq(v.label, "Example drop");
        assertEq(v.attestCount, 0);
        assertEq(v.flagCount, 0);
        assertEq(reg.entryIdOf(alice, src), 1);
        assertEq(reg.entryCountForSource(src), 1);
        assertEq(reg.entryCountOf(alice), 1);
    }

    function test_register_emits() public {
        vm.roll(7);
        vm.expectEmit(true, true, true, true);
        emit SourceRegistered(1, src, alice, 1, H, "https://example.org/rules", "Example drop", 7);
        _reg(alice, src);
    }

    function test_register_sameSourceByTwoWallets() public {
        _reg(alice, src);
        _reg(bob, src);
        uint256[] memory ids = reg.entryIdsForSource(src, 0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_register_revertsTwiceSameWallet() public {
        _reg(alice, src);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.AlreadyRegistered.selector, 1));
        reg.register(src, 2, "https://example.org/other", H, "Again");
    }

    function test_register_revertsNoCode() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.NotAContract.selector, address(0xdead)));
        reg.register(address(0xdead), 1, "https://example.org", H, "x");
    }

    function test_register_revertsBadKind() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadKind.selector, 0));
        reg.register(src, 0, "https://example.org", H, "x");
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadKind.selector, 6));
        reg.register(src, 6, "https://example.org", H, "x");
        vm.stopPrank();
    }

    function test_register_urlRules() public {
        vm.startPrank(alice);
        string[6] memory bad = ["http://example.org", "https://", "ftp://x.org/a", "https://a b", "https://a\x7f", "HTTPS://a.org"];
        for (uint256 i = 0; i < bad.length; i++) {
            vm.expectRevert(ReclaSourceRegistry.BadUrl.selector);
            reg.register(src, 1, bad[i], H, "x");
        }
        bytes memory long = new bytes(201);
        for (uint256 i = 0; i < long.length; i++) long[i] = "a";
        for (uint256 i = 0; i < 8; i++) long[i] = bytes("https://")[i];
        vm.expectRevert(ReclaSourceRegistry.BadUrl.selector);
        reg.register(src, 1, string(long), H, "x");
        bytes memory ok = new bytes(200);
        for (uint256 i = 0; i < ok.length; i++) ok[i] = "a";
        for (uint256 i = 0; i < 8; i++) ok[i] = bytes("https://")[i];
        reg.register(src, 1, string(ok), H, "x");
        vm.stopPrank();
    }

    function test_register_labelRules() public {
        vm.startPrank(alice);
        string[4] memory bad = ["", " lead", "trail ", "tab\there"];
        for (uint256 i = 0; i < bad.length; i++) {
            vm.expectRevert(ReclaSourceRegistry.BadLabel.selector);
            reg.register(src, 1, "https://example.org", H, bad[i]);
        }
        vm.expectRevert(ReclaSourceRegistry.BadLabel.selector);
        reg.register(src, 1, "https://example.org", H, "0123456789012345678901234567890123456789012345678");
        reg.register(src, 1, "https://example.org", H, "012345678901234567890123456789012345678901234567");
        vm.stopPrank();
    }

    function test_register_revertsZeroHash() public {
        vm.prank(alice);
        vm.expectRevert(ReclaSourceRegistry.BadRulesHash.selector);
        reg.register(src, 1, "https://example.org", bytes32(0), "x");
    }

    function test_register_allKinds() public {
        for (uint8 k = 1; k <= 5; k++) {
            address s = address(new Dummy());
            vm.prank(alice);
            reg.register(s, k, "https://example.org", H, "k");
            assertEq(reg.getEntry(k).kind, k);
        }
    }

    // ---------------------------------------------------------------- attest / flag

    function test_attest_counts() public {
        _reg(alice, src);
        vm.roll(9);
        vm.expectEmit(true, true, false, true);
        emit Attested(1, bob, 1, 9);
        vm.prank(bob);
        reg.attest(1);
        vm.prank(carol);
        reg.attest(1);
        assertEq(reg.getEntry(1).attestCount, 2);
        assertEq(reg.attestTotal(), 2);
        (uint8 s, uint8 r) = reg.stanceOf(1, bob);
        assertEq(s, 1);
        assertEq(r, 0);
    }

    function test_flag_counts() public {
        _reg(alice, src);
        vm.roll(11);
        vm.expectEmit(true, true, false, true);
        emit Flagged(1, bob, 4, 1, 11);
        vm.prank(bob);
        reg.flag(1, 4);
        assertEq(reg.getEntry(1).flagCount, 1);
        assertEq(reg.flagTotal(), 1);
        (uint8 s, uint8 r) = reg.stanceOf(1, bob);
        assertEq(s, 2);
        assertEq(r, 4);
    }

    function test_respond_oncePerWallet() public {
        _reg(alice, src);
        vm.startPrank(bob);
        reg.attest(1);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.AlreadyResponded.selector, 1, 1));
        reg.attest(1);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.AlreadyResponded.selector, 1, 1));
        reg.flag(1, 1);
        vm.stopPrank();
        vm.startPrank(carol);
        reg.flag(1, 2);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.AlreadyResponded.selector, 1, 2));
        reg.attest(1);
        vm.stopPrank();
    }

    function test_respond_notOwnEntry() public {
        _reg(alice, src);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.OwnEntry.selector, 1));
        reg.attest(1);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.OwnEntry.selector, 1));
        reg.flag(1, 1);
        vm.stopPrank();
    }

    function test_respond_unknownEntry() public {
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.UnknownEntry.selector, 0));
        reg.attest(0);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.UnknownEntry.selector, 1));
        reg.flag(1, 1);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.UnknownEntry.selector, 3));
        reg.getEntry(3);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.UnknownEntry.selector, 3));
        reg.stanceOf(3, bob);
    }

    function test_flag_badReason() public {
        _reg(alice, src);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadReason.selector, 0));
        reg.flag(1, 0);
        vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadReason.selector, 6));
        reg.flag(1, 6);
        vm.stopPrank();
    }

    function test_stancePerEntry() public {
        _reg(alice, src);
        _reg(alice, src2);
        vm.startPrank(bob);
        reg.attest(1);
        reg.flag(2, 3);
        vm.stopPrank();
        assertEq(reg.getEntry(1).attestCount, 1);
        assertEq(reg.getEntry(2).flagCount, 1);
    }

    // ---------------------------------------------------------------- pages

    function test_pages() public {
        for (uint256 i = 0; i < 5; i++) _reg(alice, address(new Dummy()));
        ReclaSourceRegistry.EntryView[] memory page = reg.entries(0, 3);
        assertEq(page.length, 3);
        assertEq(page[0].id, 1);
        page = reg.entries(4, 10);
        assertEq(page.length, 2);
        assertEq(page[1].id, 5);
        assertEq(reg.entries(6, 10).length, 0);
        uint256[] memory mine = reg.entryIdsOf(alice, 3, 10);
        assertEq(mine.length, 2);
        assertEq(mine[0], 4);
        assertEq(reg.entryIdsOf(alice, 9, 10).length, 0);
        assertEq(reg.entryIdsOf(bob, 0, 10).length, 0);
    }

    function test_pageCap() public {
        for (uint256 i = 0; i < 101; i++) _reg(address(uint160(1000 + i)), src);
        assertEq(reg.entries(1, 500).length, 100);
        assertEq(reg.entryIdsForSource(src, 0, 500).length, 100);
    }

    // ---------------------------------------------------------------- funds and block

    function test_rejectsEth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(reg).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(reg).balance, 0);
    }

    function test_chainBlock_fallback() public {
        vm.roll(123);
        assertEq(reg.chainBlock(), 123);
    }

    function test_chainBlock_arbSys() public {
        vm.etch(address(0x64), hex"6301c9c38060005260206000f3"); // returns 30000000 (0x01c9c380)
        vm.roll(5);
        assertEq(reg.chainBlock(), 30_000_000);
    }

    function test_chainBlock_arbSysReverting() public {
        vm.etch(address(0x64), hex"60006000fd");
        vm.roll(77);
        assertEq(reg.chainBlock(), 77);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_kind(uint8 kind) public {
        vm.prank(alice);
        if (kind < 1 || kind > 5) {
            vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadKind.selector, kind));
            reg.register(src, kind, "https://example.org", H, "x");
        } else {
            reg.register(src, kind, "https://example.org", H, "x");
            assertEq(reg.getEntry(1).kind, kind);
        }
    }

    function testFuzz_reason(uint8 reason) public {
        _reg(alice, src);
        vm.prank(bob);
        if (reason == 0 || reason > 5) {
            vm.expectRevert(abi.encodeWithSelector(ReclaSourceRegistry.BadReason.selector, reason));
            reg.flag(1, reason);
        } else {
            reg.flag(1, reason);
            (, uint8 r) = reg.stanceOf(1, bob);
            assertEq(r, reason);
        }
    }

    function testFuzz_labelBytes(bytes memory label) public {
        vm.prank(alice);
        bool valid = label.length > 0 && label.length <= 48 && label[0] != 0x20 && label[label.length - 1] != 0x20;
        for (uint256 i = 0; valid && i < label.length; i++) if (uint8(label[i]) < 0x20 || uint8(label[i]) >= 0x7f) valid = false;
        if (!valid) vm.expectRevert(ReclaSourceRegistry.BadLabel.selector);
        reg.register(src, 1, "https://example.org", H, string(label));
    }

    function testFuzz_manyResponders(uint8 n) public {
        _reg(alice, src);
        uint256 a;
        uint256 f;
        for (uint256 i = 0; i < n; i++) {
            address w = address(uint160(0x10000 + i));
            vm.prank(w);
            if (i % 3 == 0) {
                reg.flag(1, uint8(1 + (i % 5)));
                f++;
            } else {
                reg.attest(1);
                a++;
            }
        }
        ReclaSourceRegistry.EntryView memory v = reg.getEntry(1);
        assertEq(v.attestCount, a);
        assertEq(v.flagCount, f);
    }
}
