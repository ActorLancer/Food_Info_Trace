## RUN
- `docker compose up -d`
- `cargo run`
- `npx hardhat node --localhost 127.0.0.1 --port 8545`
- `npx hardhat compile`
- `npx hardhat run /scripts/depoly.js --network localhost`
- Write down the deployed contract address and modify the file: food_traceability_platform/frontend_typescript/src/utils/blockchain.ts , viriable: FOOD_TRACEABILITY_CONTRACT_ADDRESS and FOOD_TRACEABILITY_ABI.
- `npm run dev`
- `npx hardhat `

## 开发中遇到的可能忽视的问题
- 每次重新启动hardhat网络，必须重新部署合约并修改前端代码中的合约地址以及合约API，并且重新建立区块链网络会导致之前所有链上的数据消失，导致不能通过链上数据查询验证之前的数据，但能通过后端访问数据库内容，无法验证数据真实性。
- 
