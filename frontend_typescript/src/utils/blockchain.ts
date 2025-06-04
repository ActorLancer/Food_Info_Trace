// food_traceability_platform/frontend_typescript/src/utils/blockchain.ts
import { ethers, BrowserProvider, Contract, type Signer } from "ethers";

// 从 Hardhat 部署脚本中获取的合约地址
// TODO: 将这里的地址替换为您实际部署的合约地址
const FOOD_TRACEABILITY_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // <--- 替换这里!!!

// 从 Hardhat artifacts 中获取的 ABI (部分)
// 实际项目中, 您会从 artifacts/contracts/FoodTraceability.sol/FoodTraceability.json 获取完整的 ABI
// 这里只列出我们将用到的 addRecord 和 getMetadataHash
const FOOD_TRACEABILITY_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "productId",
        type: "string",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "metadataHash",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "recorder",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "RecordAdded",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_productId",
        type: "string",
      },
      {
        internalType: "bytes32",
        name: "_metadataHash",
        type: "bytes32",
      },
    ],
    name: "addRecord",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "_metadataHash",
        type: "bytes32",
      },
    ],
    name: "checkMetadataHashExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_productId",
        type: "string",
      },
    ],
    name: "getMetadataHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "metadataHashExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "records",
    outputs: [
      {
        internalType: "bytes32",
        name: "metadataHash",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "recorder",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

interface EthereumWindow extends Window {
  ethereum?: ethers.Eip1193Provider;
}

declare let window: EthereumWindow;

// 获取 Provider 和 Signer
export const getProviderAndSigner = async (): Promise<{
  provider: BrowserProvider;
  signer: Signer;
  signerAddress: string;
} | null> => {
  if (!window.ethereum) {
    alert("请安装 Metamask 插件!");
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    // 请求账户权限
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    return { provider, signer, signerAddress };
  } catch (error) {
    console.error("连接 Metamask 失败:", error);
    alert("连接 Metamask 失败。请在 Metamask 中选择一个账户。");
    return null;
  }
};

// 获取智能合约实例
export const getFoodTraceabilityContract = (
  signerOrProvider: Signer | BrowserProvider,
): Contract => {
  return new ethers.Contract(
    FOOD_TRACEABILITY_CONTRACT_ADDRESS,
    FOOD_TRACEABILITY_ABI,
    signerOrProvider,
  );
};

// 计算元数据的 Keccak256 哈希
export const calculateMetadataHash = (metadata: object): string => {
  const metadataString = JSON.stringify(metadata);
  return ethers.keccak256(ethers.toUtf8Bytes(metadataString));
};
