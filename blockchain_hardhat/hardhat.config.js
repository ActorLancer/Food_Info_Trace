// food_traceability_platform/blockchain_hardhat/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20", // 确保此版本与合约中的 pragma 版本一致
  networks: {
    hardhat: { // 本地开发网络配置
      chainId: 1337, // Metamask 连接本地网络时使用的 Chain ID
      // gas: "auto", // 可以不设置，Hardhat 会自动处理
      // gasPrice: "auto",
    },
    // localhost: { // 如果你单独运行 `npx hardhat node`，然后用脚本连接它
    //   url: "http://127.0.0.1:8545",
    //   chainId: 31337, // Hardhat Node 默认的 chainId
    // }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};
