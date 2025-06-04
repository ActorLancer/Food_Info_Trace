// 最好是在这里定义常量并导出，保证一致性
import { ethers, BrowserProvider, Contract, type Signer, type Eip1193Provider } from "ethers";
// 从 Hardhat 部署脚本中获取的合约地址
// 将这里的地址替换为实际部署的合约地址
const FOOD_TRACEABILITY_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // <--- 替换这里!!!

// 从 Hardhat artifacts 中获取的 ABI (部分)
// 从 artifacts/contracts/FoodTraceability.sol/FoodTraceability.json 获取完整的 ABI
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

// 定义期望的网络信息 (Hardhat 本地网络)，用于导出配置
export const EXPECTED_CHAIN_ID = "0x539"; // 1337 的十六进制形式 (默认为：0x7A69 for 31337)
export const EXPECTED_NETWORK_NAME = "Hardhat Local"; // 添加网络时的提示
export const EXPECTED_RPC_URL = "http://127.0.0.1:8545"; // Hardhat RPC
export const EXPECTED_CURRENCY_SYMBOL = "ETH"; // or "GO"

interface EthereumWindow extends Window {
  ethereum?: Eip1193Provider & { isMetaMask?: boolean; selectedAddress?: string | null };
}
declare let window: EthereumWindow;

// 尝试添加或切换到期望的网络
const switchToExpectedNetwork = async (provider: BrowserProvider): Promise<boolean> => {
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: EXPECTED_CHAIN_ID }]);
    console.log(`成功切换到网络: ${EXPECTED_NETWORK_NAME}`);
    return true;
  } catch (switchErr: unknown) {
    // 修改为 unknown
    // This error code indicates that the chain has not been added to MetaMask.
    let code: number | undefined;
    if (typeof switchErr === "object" && switchErr !== null) {
      const error = switchErr as { code?: number }; // 类型断言
      code = error.code;
    }

    if (code === 4902) {
      try {
        console.log(`网络 ${EXPECTED_NETWORK_NAME} 未添加，尝试添加...`);
        await provider.send("wallet_addEthereumChain", [
          /* ... */
        ]);
        console.log(`成功添加并切换到网络: ${EXPECTED_NETWORK_NAME}`);
        return true;
      } catch (addErr: unknown) {
        console.error(`添加网络 ${EXPECTED_NETWORK_NAME} 失败:`, addErr);
        let addErrorMessage = `添加网络 ${EXPECTED_NETWORK_NAME} 失败。请手动在 Metamask 中添加。`;
        if (typeof addErr === "object" && addErr !== null) {
          const nestedError = addErr as { message?: string };
          if (nestedError.message) {
            addErrorMessage = `添加网络失败: ${nestedError.message}`; // TODO: 可以选择更详细
          }
        }
        alert(addErrorMessage);
        return false;
      }
    }
    console.error("切换网络失败:", switchErr);
    alert(`切换到网络 ${EXPECTED_NETWORK_NAME} 失败。请在 Metamask 中手动切换。`);
    return false;
  }
};

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
    const provider = new ethers.BrowserProvider(window.ethereum, "any"); // TODO: "any" 允许连接到任何网络（稍后检查）

    // 1. 检查当前网络
    const network = await provider.getNetwork();
    const currentChainId = `0x${network.chainId.toString(16)}`; // 获取当前 chainId 并转为十六进制字符串

    if (currentChainId !== EXPECTED_CHAIN_ID) {
      alert(
        `请切换到 ${EXPECTED_NETWORK_NAME} (Chain ID: ${EXPECTED_CHAIN_ID})。\n您当前连接的网络是: ${network.name} (Chain ID: ${currentChainId})`,
      );
      const switched = await switchToExpectedNetwork(provider);
      if (!switched) {
        return null; // 如果切换失败或用户取消，则不继续
      }
      // 切换网络后，Metamask 通常会刷新页面，或者 provider/signer 可能需要重新获取
      // 为简单起见，这里可以提示用户刷新页面，或者理想情况下是重新执行连接逻辑
      // 对于更流畅的体验，切换成功后可以再次调用 provider.getSigner()
      // 但 Metamask 切换网络后，页面可能会被强制刷新，所以下面的代码可能不会立即执行
      // TODO: 这里假设如果切换成功，后续的 eth_requestAccounts 会在正确的网络上进行
    }

    // 2. 请求账户权限 (如果网络正确或已成功切换)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    console.log(`成功连接到钱包: ${signerAddress} 在网络: ${network.name} (ID: ${currentChainId})`);
    return { provider, signer, signerAddress };
  } catch (err: unknown) {
    // 修改为 unknown
    console.error("连接 Metamask 或处理网络切换失败:", err);
    let alertMessage = "连接 Metamask 失败。"; // 使用不同的变量名避免与外层作用域冲突（如果可能）

    if (typeof err === "object" && err !== null) {
      const error = err as { message?: string; code?: number | string }; // 类型断言
      if (
        typeof error.message === "string" &&
        error.message.includes("User rejected the request")
      ) {
        alertMessage = "用户拒绝了连接请求。";
      } else if (
        error.code === 4001 ||
        (typeof error.code === "string" && parseInt(error.code, 10) === 4001)
      ) {
        // EIP-1193 user rejected request (Metamask often returns code as number)
        alertMessage = "用户拒绝了钱包请求。";
      } else if (typeof error.message === "string" && error.message) {
        // Fallback to error.message if available and no specific code matched
        alertMessage = error.message; // 可以选择显示原始错误，但通常上面的更友好
      }
    } else if (typeof err === "string") {
      alertMessage = err; // 如果错误本身就是字符串
    }
    alert(alertMessage);
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
