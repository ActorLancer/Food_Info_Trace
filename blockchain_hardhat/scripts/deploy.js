async function main() {
  const [deployer] = await ethers.getSigners(); // 获取部署者账户

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  // 获取合约工厂
  const FoodTraceability = await ethers.getContractFactory("FoodTraceability");

  // 部署合约
  console.log("Deploying FoodTraceability...");
  const foodTraceability = await FoodTraceability.deploy();

  // 等待合约部署完成
  await foodTraceability.waitForDeployment();
  const contractAddress = await foodTraceability.getAddress();

  console.log("FoodTraceability contract deployed to:", contractAddress);
  console.log(
    "Transaction hash:",
    foodTraceability.deploymentTransaction().hash
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
