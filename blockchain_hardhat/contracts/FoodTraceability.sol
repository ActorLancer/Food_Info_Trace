// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // 使用一个较新的稳定版本

import "hardhat/console.sol"; // 用于调试

contract FoodTraceability {
    struct Record {
        bytes32 metadataHash;
        address recorder;
        uint256 timestamp;
    }

    mapping(string => Record) public records;
    mapping(bytes32 => bool) public metadataHashExists; // 检查哈希是否已存在

    event RecordAdded(
        string indexed productId,
        bytes32 indexed metadataHash,
        address indexed recorder,
        uint256 timestamp
    );

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        console.log("FoodTraceability contract deployed by:", owner);
        console.log("Contract address will be available after deployment.");
    }

    function addRecord(string memory _productId, bytes32 _metadataHash) public { // 实际应用中可添加 onlyOwner 或其他权限控制（目前本地网络测试）
        // require(!metadataHashExists[_metadataHash], "Metadata hash already exists to prevent duplicates");
        // require(records[_productId].timestamp == 0, "Product ID already has a record; use update function if needed");

        records[_productId] = Record({
            metadataHash: _metadataHash,
            recorder: msg.sender,
            timestamp: block.timestamp
        });
        metadataHashExists[_metadataHash] = true;

        emit RecordAdded(_productId, _metadataHash, msg.sender, block.timestamp);
        // console.log ("Record added. Product ID: %s, Metadata Hash: %s, Recorder: %s, Timestamp: %d", _productId, _metadataHash, msg.sender, block.timestamp);
        console.log("Record added");
        console.logBytes32(keccak256(bytes(_productId))); // 打印 productId 的 hash
        console.logBytes32(_metadataHash);
        console.logAddress(msg.sender);
        console.logUint(block.timestamp);
    }

    function getMetadataHash(string memory _productId) public view returns (bytes32) {
        require(records[_productId].timestamp != 0, "Record not found for this productId");
        return records[_productId].metadataHash;
    }

    function checkMetadataHashExists(bytes32 _metadataHash) public view returns (bool) {
        return metadataHashExists[_metadataHash];
    }

    // 函数来更改owner，如果需要
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        owner = newOwner;
    }
}
