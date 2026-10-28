// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReclaSourceRegistry
/// @notice Public list of claim sources on Robinhood Chain. Any wallet registers a contract that pays out claims
///         (a Merkle distributor, a vesting or lock contract, a refund contract, a fee escrow…) together with the
///         link to its published rules and a hash of those rules. Other wallets then attest "the rules match the
///         contract" or flag the entry with a reason code, at most once per wallet per entry. Counts are public and
///         nothing is ever hidden or removed by the contract.
///         The registry stores references only. It never holds, moves or promises funds, it cannot read the rules
///         page, and an attestation proves only that a wallet said so at that moment.
/// @dev No owner, no admin, no fee, no pause, no upgrade path, no constructor arguments, no token. No function is
///      payable and there is no receive or fallback, so ETH transfers revert.
///      On Arbitrum-style chains `block.number` reports the parent chain's block, so the chain's own block is read
///      from the ArbSys precompile when it answers, and from `block.number` everywhere else (local tests).
contract ReclaSourceRegistry {
    /// @notice Source kinds. The site picks its read path from the kind; KIND_OTHER is listed but never read.
    uint8 public constant KIND_MERKLE = 1;
    uint8 public constant KIND_VESTING = 2;
    uint8 public constant KIND_REFUND = 3;
    uint8 public constant KIND_ESCROW = 4;
    uint8 public constant KIND_OTHER = 5;

    /// @notice Flag reasons: 1 rules do not match the contract, 2 rules link broken, 3 impersonates another project,
    ///         4 asks for an approval or payment to claim, 5 other.
    uint8 public constant MAX_REASON = 5;

    /// @notice Longest rules URL accepted (https only).
    uint256 public constant MAX_URL_LENGTH = 200;
    /// @notice Longest label accepted (printable ASCII).
    uint256 public constant MAX_LABEL_LENGTH = 48;
    /// @notice Most entries a paginated read returns at once.
    uint256 public constant MAX_PAGE = 100;

    /// @notice A wallet's stance on an entry.
    uint8 public constant STANCE_NONE = 0;
    uint8 public constant STANCE_ATTEST = 1;
    uint8 public constant STANCE_FLAG = 2;

    /// @dev ArbSys precompile. `arbBlockNumber()` returns the chain's own block number.
    address private constant ARB_SYS = address(0x64);
    bytes4 private constant ARB_BLOCK_NUMBER = 0xa3b1b31d;
    /// @dev Gas forwarded to ArbSys; the cap keeps a chain where 0x64 holds failing code from burning all gas.
    uint256 private constant ARB_SYS_GAS = 30_000;

    struct Entry {
        address source;
        uint8 kind;
        address registrant;
        uint64 registeredBlock;
        uint64 registeredAt;
        uint32 attestCount;
        uint32 flagCount;
        bytes32 rulesHash;
        string rulesUrl;
        string label;
    }

    /// @notice An entry as the read functions return it.
    struct EntryView {
        uint256 id;
        address source;
        uint8 kind;
        address registrant;
        uint64 registeredBlock;
        uint64 registeredAt;
        uint32 attestCount;
        uint32 flagCount;
        bytes32 rulesHash;
        string rulesUrl;
        string label;
    }

    Entry[] private _entries;
    /// @dev keccak256(registrant, source) => entry id (0 = none). One entry per wallet per source.
    mapping(bytes32 => uint256) private _byRegistrantSource;
    mapping(address => uint256[]) private _bySource;
    mapping(address => uint256[]) private _byRegistrant;
    /// @dev entry id => wallet => stance.
    mapping(uint256 => mapping(address => uint8)) private _stance;
    /// @dev entry id => wallet => flag reason (only when the stance is a flag).
    mapping(uint256 => mapping(address => uint8)) private _reason;
    uint256 private _attestTotal;
    uint256 private _flagTotal;

    event SourceRegistered(
        uint256 indexed id,
        address indexed source,
        address indexed registrant,
        uint8 kind,
        bytes32 rulesHash,
        string rulesUrl,
        string label,
        uint64 chainBlock
    );
    event Attested(uint256 indexed id, address indexed wallet, uint32 attestCount, uint64 chainBlock);
    event Flagged(uint256 indexed id, address indexed wallet, uint8 reason, uint32 flagCount, uint64 chainBlock);

    error NotAContract(address source);
    error BadKind(uint8 kind);
    error BadUrl();
    error BadLabel();
    error BadRulesHash();
    error AlreadyRegistered(uint256 id);
    error UnknownEntry(uint256 id);
    error OwnEntry(uint256 id);
    error AlreadyResponded(uint256 id, uint8 stance);
    error BadReason(uint8 reason);

    // ---------------------------------------------------------------- writes

    /// @notice Registers `source` as a claim source. The caller becomes the entry's registrant.
    /// @param source Contract that pays out the claims; must hold code now.
    /// @param kind One of KIND_MERKLE … KIND_OTHER.
    /// @param rulesUrl https:// link to the published rules (printable ASCII, no spaces, ≤ 200 bytes).
    /// @param rulesHash keccak256 of the rules text as published (non-zero).
    /// @param label Short name shown in lists (printable ASCII, 1–48 bytes, no leading/trailing space).
    function register(address source, uint8 kind, string calldata rulesUrl, bytes32 rulesHash, string calldata label)
        external
        returns (uint256 id)
    {
        if (source.code.length == 0) revert NotAContract(source);
        if (kind < KIND_MERKLE || kind > KIND_OTHER) revert BadKind(kind);
        if (!_isUrl(bytes(rulesUrl))) revert BadUrl();
        if (rulesHash == bytes32(0)) revert BadRulesHash();
        if (!_isLabel(bytes(label))) revert BadLabel();
        bytes32 key = keccak256(abi.encode(msg.sender, source));
        uint256 existing = _byRegistrantSource[key];
        if (existing != 0) revert AlreadyRegistered(existing);

        uint64 blk = chainBlock();
        _entries.push(
            Entry({
                source: source,
                kind: kind,
                registrant: msg.sender,
                registeredBlock: blk,
                registeredAt: uint64(block.timestamp),
                attestCount: 0,
                flagCount: 0,
                rulesHash: rulesHash,
                rulesUrl: rulesUrl,
                label: label
            })
        );
        id = _entries.length;
        _byRegistrantSource[key] = id;
        _bySource[source].push(id);
        _byRegistrant[msg.sender].push(id);
        emit SourceRegistered(id, source, msg.sender, kind, rulesHash, rulesUrl, label, blk);
    }

    /// @notice Says "the published rules match this contract". Once per wallet per entry; not by its registrant.
    function attest(uint256 id) external {
        Entry storage e = _respond(id);
        _stance[id][msg.sender] = STANCE_ATTEST;
        uint32 n = e.attestCount + 1;
        e.attestCount = n;
        _attestTotal += 1;
        emit Attested(id, msg.sender, n, chainBlock());
    }

    /// @notice Flags an entry with a reason code (1–5). Once per wallet per entry; not by its registrant.
    ///         Flags are counted and shown; nothing is hidden by the contract.
    function flag(uint256 id, uint8 reason) external {
        if (reason == 0 || reason > MAX_REASON) revert BadReason(reason);
        Entry storage e = _respond(id);
        _stance[id][msg.sender] = STANCE_FLAG;
        _reason[id][msg.sender] = reason;
        uint32 n = e.flagCount + 1;
        e.flagCount = n;
        _flagTotal += 1;
        emit Flagged(id, msg.sender, reason, n, chainBlock());
    }

    // ---------------------------------------------------------------- reads

    function entryCount() external view returns (uint256) {
        return _entries.length;
    }

    function attestTotal() external view returns (uint256) {
        return _attestTotal;
    }

    function flagTotal() external view returns (uint256) {
        return _flagTotal;
    }

    function getEntry(uint256 id) public view returns (EntryView memory v) {
        Entry storage e = _get(id);
        v = EntryView({
            id: id,
            source: e.source,
            kind: e.kind,
            registrant: e.registrant,
            registeredBlock: e.registeredBlock,
            registeredAt: e.registeredAt,
            attestCount: e.attestCount,
            flagCount: e.flagCount,
            rulesHash: e.rulesHash,
            rulesUrl: e.rulesUrl,
            label: e.label
        });
    }

    /// @notice Entries `fromId`, `fromId + 1`, … (ids start at 1), at most `limit` (capped at MAX_PAGE).
    function entries(uint256 fromId, uint256 limit) external view returns (EntryView[] memory out) {
        uint256 total = _entries.length;
        if (fromId == 0) fromId = 1;
        if (fromId > total) return new EntryView[](0);
        uint256 n = _min(_min(limit, MAX_PAGE), total - fromId + 1);
        out = new EntryView[](n);
        for (uint256 i = 0; i < n; i++) out[i] = getEntry(fromId + i);
    }

    function entryCountForSource(address source) external view returns (uint256) {
        return _bySource[source].length;
    }

    function entryIdsForSource(address source, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _slice(_bySource[source], offset, limit);
    }

    function entryCountOf(address registrant) external view returns (uint256) {
        return _byRegistrant[registrant].length;
    }

    function entryIdsOf(address registrant, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _slice(_byRegistrant[registrant], offset, limit);
    }

    /// @notice Entry id `registrant` made for `source` (0 = none).
    function entryIdOf(address registrant, address source) external view returns (uint256) {
        return _byRegistrantSource[keccak256(abi.encode(registrant, source))];
    }

    /// @notice A wallet's stance on an entry and, for a flag, its reason.
    function stanceOf(uint256 id, address wallet) external view returns (uint8 stance, uint8 reason) {
        _get(id);
        stance = _stance[id][wallet];
        reason = _reason[id][wallet];
    }

    /// @notice The chain's current block: ArbSys `arbBlockNumber()` when the precompile answers, else `block.number`.
    function chainBlock() public view returns (uint64) {
        (bool ok, bytes memory ret) = ARB_SYS.staticcall{gas: ARB_SYS_GAS}(abi.encodeWithSelector(ARB_BLOCK_NUMBER));
        if (ok && ret.length == 32) {
            uint256 n = abi.decode(ret, (uint256));
            if (n != 0 && n <= type(uint64).max) return uint64(n);
        }
        return uint64(block.number);
    }

    // ---------------------------------------------------------------- internals

    function _get(uint256 id) private view returns (Entry storage) {
        if (id == 0 || id > _entries.length) revert UnknownEntry(id);
        return _entries[id - 1];
    }

    function _respond(uint256 id) private view returns (Entry storage e) {
        e = _get(id);
        if (e.registrant == msg.sender) revert OwnEntry(id);
        uint8 s = _stance[id][msg.sender];
        if (s != STANCE_NONE) revert AlreadyResponded(id, s);
    }

    function _slice(uint256[] storage list, uint256 offset, uint256 limit) private view returns (uint256[] memory out) {
        uint256 total = list.length;
        if (offset >= total) return new uint256[](0);
        uint256 n = _min(_min(limit, MAX_PAGE), total - offset);
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) out[i] = list[offset + i];
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @dev "https://" + at least one more byte, printable ASCII without spaces, ≤ MAX_URL_LENGTH.
    function _isUrl(bytes memory b) private pure returns (bool) {
        if (b.length < 9 || b.length > MAX_URL_LENGTH) return false;
        bytes memory p = bytes("https://");
        for (uint256 i = 0; i < 8; i++) if (b[i] != p[i]) return false;
        for (uint256 i = 8; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c <= 0x20 || c >= 0x7f) return false;
        }
        return true;
    }

    /// @dev 1–48 bytes of printable ASCII (space allowed inside), no leading or trailing space.
    function _isLabel(bytes memory b) private pure returns (bool) {
        if (b.length == 0 || b.length > MAX_LABEL_LENGTH) return false;
        if (b[0] == 0x20 || b[b.length - 1] == 0x20) return false;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 0x20 || c >= 0x7f) return false;
        }
        return true;
    }
}
