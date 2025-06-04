// food_traceability_platform/frontend_typescript/src/pages/AddFoodPage.tsx
import { type Eip1193Provider } from 'ethers'; // 导入 Eip1193Provider 类型
import React, { useState, useEffect } from 'react'; // 修改点1: useEffect 将被使用
import { type Signer, type Contract } from 'ethers'; // 修改点2 & 3: 移除 ethers, Signer/Contract 为 type-only
import { getProviderAndSigner, getFoodTraceabilityContract, calculateMetadataHash } from '../utils/blockchain';

// 定义表单数据的接口
interface FoodFormData {
    productId: string;
    productName: string;
    producerInfo: string;
    productionDate: string;
    origin: string;
    // 可以根据需要添加更多字段
}

// 声明 window.ethereum 的类型
declare global {
    interface Window {
        ethereum?: Eip1193Provider & { // 使用 Eip1193Provider 并添加 Metamask 特有的属性
            isMetaMask?: boolean;
            selectedAddress?: string | null;
            // 根据需要可以添加其他 Metamask 提供的属性
        };
    }
}

const AddFoodPage: React.FC = () => {
    const [signer, setSigner] = useState<Signer | null>(null);
    const [signerAddress, setSignerAddress] = useState<string | null>(null);
    const [contract, setContract] = useState<Contract | null>(null);
    const [formData, setFormData] = useState<FoodFormData>({
        productId: '',
        productName: '',
        producerInfo: '',
        productionDate: '',
        origin: '',
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>(''); // 用于显示成功或错误消息

    const connectWallet = async () => {
        setIsLoading(true);
        setMessage('');
        const connection = await getProviderAndSigner();
        if (connection) {
            setSigner(connection.signer);
            setSignerAddress(connection.signerAddress);
            const foodContract = getFoodTraceabilityContract(connection.signer);
            setContract(foodContract);
            setMessage(`钱包已连接: ${connection.signerAddress}`);
        } else {
            setMessage('连接钱包失败。');
        }
        setIsLoading(false);
    };

    // 页面加载时尝试自动连接（如果之前已授权）
    useEffect(() => {
        // 检查 window.ethereum 是否存在以及 selectedAddress 是否可用 (表示用户之前可能已连接)
        // isMetaMask 检查确保我们只在Metamask环境下尝试自动连接
        if (window.ethereum?.isMetaMask && window.ethereum.selectedAddress) {
             console.log("检测到已连接的Metamask账户, 尝试自动重连...");
             connectWallet();
        }
    }, []); // 空依赖数组确保只在组件挂载时运行一次


    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!signer || !contract) {
            setMessage('请先连接钱包。');
            return;
        }
        if (!formData.productId || !formData.productName) {
            setMessage('产品ID和产品名称不能为空。');
            return;
        }

        setIsLoading(true);
        setMessage('正在处理...');

        try {
            // 1. 准备元数据并计算哈希
            const metadata = { ...formData }; // 可以添加更多固定信息，如版本号、时间戳等
            const metadataHash = calculateMetadataHash(metadata);
            console.log("元数据:", metadata);
            console.log("元数据哈希 (前端计算):", metadataHash);

            // 2. 调用智能合约的 addRecord 方法
            setMessage('正在请求 Metamask 授权交易...');
            const tx = await contract.addRecord(formData.productId, metadataHash);
            setMessage('交易已发送，等待区块链确认...');
            console.log("交易发送:", tx);

            const receipt = await tx.wait(); // 等待交易被打包确认
            console.log("交易回执:", receipt);

            if (receipt.status === 0) {
                throw new Error("区块链交易失败，请检查交易详情。");
            }

            const transactionHash = receipt.hash; // 使用 receipt.hash 作为交易哈希
            setMessage(`数据哈希已成功上链！交易哈希: ${transactionHash}`);

            // 3. 将元数据和交易信息发送到后端进行持久化
            // 调用后端 API
            const backendPayload = {
                        productId: formData.productId,
                        metadata: metadata,
                        metadataHashOnChain: metadataHash,
                        transactionHash: transactionHash,
                    };
                    console.log("准备发送到后端的数据:", backendPayload);
                    setMessage('正在将数据发送到后端服务器...');

                    // 获取后端服务器地址 (可以考虑配置化)
                    // 假设后端运行在 http://127.0.0.1:8080 (这是我们在 Rust .env 中配置的)
                    // const backendUrl = 'http://127.0.0.1:8080/api/food-records';
                    const backendUrl = '/api/food-records'; // 新的方式，使用 Vite 代理

                    const response = await fetch(backendUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(backendPayload),
                    });

                    const responseData = await response.json(); // 解析后端返回的JSON

                    if (!response.ok) { // response.ok 为 false 表示 HTTP 状态码不是 2xx
                        // responseData 可能包含后端返回的错误信息
                        const errorMessage = responseData.message || `后端请求失败，状态码: ${response.status}`;
                        throw new Error(errorMessage);
                    }

                    // 后端调用成功
                    console.log("后端响应:", responseData);
                    setMessage(`数据上链并已在后端持久化！产品ID: ${formData.productId}. ${responseData.message || ''}`);
                    // --- 修改结束 ---

                    setFormData({ // 清空表单
                        productId: '',
                        productName: '',
                        producerInfo: '',
                        productionDate: '',
                        origin: '',
                    });

        } catch (err: unknown) { // 修改点4: error 类型为 unknown
                    console.error("处理失败:", err);
                    let displayMessage = "发生未知错误，请查看控制台。";

                    if (typeof err === 'object' && err !== null) {
                        // 为 error 对象定义一个更具体的接口
                        interface EthersError {
                            message?: string;
                            data?: { message?: string }; // Metamask specific
                            reason?: string; // Contract revert reason
                            code?: number | string; // Common error code (e.g., Metamask user rejected)
                            error?: { // Nested error, often from RPC provider
                                code?: number;
                                message?: string;
                                data?: unknown; // Can be anything
                            };
                            info?: { // Ethers v6 specific for JsonRpcApiProvider errors
                                error?: { // This is often where the core RPC error lies
                                    code?: number;
                                    message?: string;
                                    data?: unknown;
                                };
                                // info can also contain other details like request and response
                                // For simplicity, we focus on info.error
                                [key: string]: unknown; // Allow other properties on info if needed
                            };
                        }

                        const error = err as EthersError;

                        if (err instanceof Error) { // Check if it's a standard Error object
                            displayMessage = err.message;
                        } else if (typeof error.message === 'string') {
                            displayMessage = error.message;
                        }

                        if (error.info?.error?.message) { // Ethers v6 RPC error in info.error
                            displayMessage = `RPC 错误: ${error.info.error.message}`;
                        } else if (error.error?.message) { // Nested error in error.error
                            displayMessage = `错误: ${error.error.message}`;
                        } else if (error.reason) { // Contract revert reason
                            displayMessage = `合约调用错误: ${error.reason}`;
                        } else if (error.data?.message) { // Metamask specific error
                            displayMessage = `Metamask 错误: ${error.data.message}`;
                        } else if (error.message) { // Generic error message
                            displayMessage = `错误: ${error.message}`;
                        }

                        // Check for user rejected request codes
                        const userRejectedCode = 4001;
                        if (error.code === userRejectedCode ||
                            error.error?.code === userRejectedCode ||
                            error.info?.error?.code === userRejectedCode) {
                            displayMessage = "用户拒绝了交易请求。";
                        }
                    } else if (typeof err === 'string') {
                        displayMessage = err;
                    }
                    setMessage(displayMessage);
                } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2>录入新食品信息</h2>
            {!signerAddress ? (
                <button onClick={connectWallet} disabled={isLoading}>
                    {isLoading ? '连接中...' : '连接 Metamask 钱包'}
                </button>
            ) : (
                <div>
                    <p>已连接钱包: {signerAddress}</p>
                    <button onClick={() => { setSigner(null); setSignerAddress(null); setContract(null); setMessage(''); }} disabled={isLoading}>
                        断开钱包
                    </button>
                </div>
            )}

            {message && <p style={{ color: message.startsWith('错误') || message.startsWith('Metamask 错误') || message.startsWith('合约调用错误') ? 'red' : 'green' }}>{message}</p>}

            {signerAddress && (
                <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                    <div>
                        <label htmlFor="productId">产品ID (批次号): </label>
                        <input type="text" id="productId" name="productId" value={formData.productId} onChange={handleInputChange} required />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <label htmlFor="productName">产品名称: </label>
                        <input type="text" id="productName" name="productName" value={formData.productName} onChange={handleInputChange} required />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <label htmlFor="producerInfo">生产商信息: </label>
                        <input type="text" id="producerInfo" name="producerInfo" value={formData.producerInfo} onChange={handleInputChange} />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <label htmlFor="productionDate">生产日期: </label>
                        <input type="date" id="productionDate" name="productionDate" value={formData.productionDate} onChange={handleInputChange} />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <label htmlFor="origin">原产地: </label>
                        <input type="text" id="origin" name="origin" value={formData.origin} onChange={handleInputChange} />
                    </div>
                    {/* 可以添加更多字段，例如使用 textarea 处理 "加工流程描述" */}
                    <button type="submit" disabled={isLoading || !signer} style={{ marginTop: '20px' }}>
                        {isLoading ? '处理中...' : '提交到区块链并保存'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default AddFoodPage;
