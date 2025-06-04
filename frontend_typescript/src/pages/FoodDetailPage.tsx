// food_traceability_platform/frontend_typescript/src/pages/FoodDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { type Signer } from 'ethers'; // 修改点1: 只保留 Signer
import { getProviderAndSigner, getFoodTraceabilityContract } from '../utils/blockchain';

// 定义更具体的 JSON 类型
type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonObject | JsonArray;

type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface FoodDetailFromAPI {
  product_id: string;
  metadata_json: JsonObject;
  onchain_metadata_hash: string;
  blockchain_transaction_hash: string;
  created_at: string;
  updated_at: string;
}

interface VerificationState {
    chainHash: string | null;
    loading: boolean;
    error: string | null;
    verified?: boolean;
}

const FoodDetailPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const [foodDetail, setFoodDetail] = useState<FoodDetailFromAPI | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [verification, setVerification] = useState<VerificationState>({
        chainHash: null,
        loading: false,
        error: null,
    });
    const [signer, setSigner] = useState<Signer | null>(null);

    useEffect(() => {
        const fetchFoodDetail = async () => {
            if (!productId) return;
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/food-records/${productId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`未找到产品ID为 ${productId} 的食品记录。`);
                    }
                    const errorData = await response.json().catch(() => ({ message: `获取食品详情失败: ${response.statusText} (状态码: ${response.status})` }));
                    throw new Error(errorData.message || `获取食品详情失败: ${response.statusText} (状态码: ${response.status})`);
                }
                const data: FoodDetailFromAPI = await response.json();
                setFoodDetail(data);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('获取食品详情时发生未知错误');
                }
                console.error(`获取食品详情 (${productId}) 错误:`, err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFoodDetail();
    }, [productId]);

    const connectWalletForVerification = async (): Promise<Signer | null> => {
        setVerification(prev => ({ ...prev, loading: true, error: null }));
        const connection = await getProviderAndSigner();
        if (connection) {
            setSigner(connection.signer);
            setVerification(prev => ({ ...prev, loading: false }));
            return connection.signer;
        }
        setVerification(prev => ({ ...prev, loading: false, error: "连接钱包失败，无法验证链上哈希。"}));
        return null;
    };

    const setMessageToVerification = (message: string, isError: boolean = false) => {
        // 更新状态，如果isError为true，则将verified设置为false或保持不变（不应设为true）
        setVerification(prev => ({
            ...prev,
            loading: false,
            error: isError ? message : null,
            chainHash: prev.chainHash, // 保持之前的链上哈希，除非有新的成功获取
            verified: isError ? false : prev.verified, // 如果是错误，验证状态不能是true
        }));
    };

    const verifyHashOnChain = async () => {
        if (!foodDetail || !productId) return;

        setVerification({ loading: true, error: null, chainHash: null, verified: undefined });

        let currentSigner = signer;
        if (!currentSigner) {
            currentSigner = await connectWalletForVerification();
            if (!currentSigner) { // connectWalletForVerification 内部会 setMessageToVerification
                return;
            }
        }

        try {
            const contractInstance = getFoodTraceabilityContract(currentSigner);
            setMessageToVerification("正在从区块链读取哈希..."); // 临时消息
            const hashFromChain = await contractInstance.getMetadataHash(productId);
            const isMatch = hashFromChain === foodDetail.onchain_metadata_hash;
            setVerification(prev => ({ // 更新所有相关状态
                ...prev,
                loading: false,
                chainHash: hashFromChain,
                verified: isMatch,
                error: null, // 清除之前的错误（如果有）
            }));
            if (isMatch) {
                // setMessageToVerification("链上哈希与数据库记录一致！数据可信。", false); // 这一行会被上面的 setVerification 覆盖
            } else {
                // setMessageToVerification("警告：链上哈希与数据库记录不一致！", true); // 同上
            }
        } catch (err: unknown) { // 修改点3: err 类型为 unknown
            console.error("从链上获取哈希失败:", err);
            let errMsg = "从链上获取哈希失败。";
            if (typeof err === 'object' && err !== null) {
                interface ChainError {
                    message?: string;
                    reason?: string;
                    info?: { error?: { message?: string, code?: number } };
                    code?: number | string;
                }
                const error = err as ChainError;
                if (error.info?.error?.message) errMsg = `RPC 错误: ${error.info.error.message}`;
                else if (error.reason) errMsg = `合约调用错误: ${error.reason}`;
                else if (error.message) errMsg = error.message;
                if (error.code === 4001 || error.info?.error?.code === 4001) errMsg = "用户拒绝了钱包请求。";

            } else if (typeof err === 'string') {
                errMsg = err;
            }
            setMessageToVerification(errMsg, true); // 这会设置 error 并将 verified 设为 false
        }
    };


    if (isLoading) return <div>正在加载食品详情...</div>;
    if (error) return <div><p style={{ color: 'red' }}>错误: {error}</p><Link to="/">返回首页</Link></div>;
    if (!foodDetail) return <div>未找到食品数据。</div>;

    const renderMetadata = (metadata: JsonObject) => { // 修改点2: 参数类型为 JsonObject
        const displayLabels: Record<string, string> = {
            productId: '产品ID (元数据内)',
            productName: '产品名称',
            producerInfo: '生产商信息',
            productionDate: '生产日期',
            origin: '原产地',
        };
        return Object.entries(metadata).map(([key, value]) => (
            <p key={key}>
                <strong>{displayLabels[key] || key}:</strong> {value === null ? 'N/A' : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
            </p>
        ));
    };

    return (
        <div>
            <h2>食品溯源详情 - {foodDetail.metadata_json.productName as string || foodDetail.product_id}</h2> {/* 假设 productName 是 string */}
            <Link to="/" style={{display: 'block', marginBottom: '20px'}}>返回列表</Link>

            <div style={{ border: '1px solid #eee', padding: '15px', marginBottom: '15px' }}>
                <h3>核心信息</h3>
                <p><strong>产品ID (数据库主键):</strong> {foodDetail.product_id}</p>
                <p><strong>链上元数据哈希 (数据库记录):</strong></p>
                <p style={{ wordBreak: 'break-all' }}>{foodDetail.onchain_metadata_hash}</p>
                <p><strong>区块链交易哈希:</strong></p>
                <p style={{ wordBreak: 'break-all' }}>{foodDetail.blockchain_transaction_hash}</p>
                <p><strong>首次录入时间:</strong> {new Date(foodDetail.created_at).toLocaleString('zh-CN')}</p>
                <p><strong>最后更新时间:</strong> {new Date(foodDetail.updated_at).toLocaleString('zh-CN')}</p>
            </div>

            <div style={{ border: '1px solid #eee', padding: '15px', marginBottom: '15px' }}>
                <h3>元数据详情 (来自数据库)</h3>
                {renderMetadata(foodDetail.metadata_json)}
            </div>

            <div style={{ border: '1px solid #eee', padding: '15px' }}>
                <h3>链上哈希验证 (通过 Metamask)</h3>
                {!signer && <button onClick={connectWalletForVerification} disabled={verification.loading}>连接钱包以验证</button>}
                {signer && <button onClick={verifyHashOnChain} disabled={verification.loading}>
                    {verification.loading ? '正在验证...' : '从区块链获取哈希并验证'}
                </button>}

                {verification.chainHash && (
                    <p style={{ marginTop: '10px' }}>
                        <strong>从区块链读取的哈希:</strong>
                        <span style={{ wordBreak: 'break-all', display: 'block' }}>{verification.chainHash}</span>
                    </p>
                )}
                {/* 根据 verification.verified 和 verification.error 来显示不同消息 */}
                {verification.verified === true && !verification.error && (
                    <p style={{ color: 'green', fontWeight: 'bold' }}>验证结果：哈希一致，数据可信！</p>
                )}
                {verification.verified === false && verification.chainHash && !verification.error && (
                    <p style={{ color: 'red', fontWeight: 'bold' }}>验证结果：警告！哈希不一致，数据可能已被篡改！</p>
                )}
                {verification.error && ( // 优先显示错误信息
                    <p style={{ color: 'red', marginTop: '10px' }}>验证提示: {verification.error}</p>
                )}
            </div>
        </div>
    );
};

export default FoodDetailPage;
