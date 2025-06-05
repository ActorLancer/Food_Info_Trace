import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; // 重命名 Link
import { type Signer } from 'ethers';
import {
    Descriptions, Button, Spin, Alert, Typography, Tag, Space, Tooltip, Divider, message as antdMessage
} from 'antd';
import { RollbackOutlined, CheckCircleOutlined, WarningOutlined, SafetyCertificateOutlined, QuestionCircleOutlined, WalletOutlined } from '@ant-design/icons';

import { getProviderAndSigner, getFoodTraceabilityContract } from '../utils/blockchain';

// 解决 window.ethereum 类型问题
// import { type Eip1193Provider } from 'ethers';
// declare global {
//     interface Window {
//         ethereum?: Eip1193Provider & { isMetaMask?: boolean; selectedAddress?: string | null; };
//     }
// }

const { Title, Paragraph, Text } = Typography;

// JSON 类型定义
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
    message?: string; // 用于显示验证过程中的具体消息
}

const FoodDetailPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const [foodDetail, setFoodDetail] = useState<FoodDetailFromAPI | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [pageError, setPageError] = useState<string | null>(null); // 页面加载错误

    const [verification, setVerification] = useState<VerificationState>({
        chainHash: null,
        loading: false,
        error: null,
        message: '',
    });
    const [signer, setSigner] = useState<Signer | null>(null);

    useEffect(() => {
        const fetchFoodDetail = async () => {
            if (!productId) return;
            setIsLoading(true);
            setPageError(null);
            try {
                const response = await fetch(`/api/food-records/${productId}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: `获取食品详情失败 (状态码: ${response.status})` }));
                    if (response.status === 404) {
                        throw new Error(`未找到产品ID为 "${productId}" 的食品记录。`);
                    }
                    throw new Error(errorData.message || `获取食品详情失败 (状态码: ${response.status})`);
                }
                const data: FoodDetailFromAPI = await response.json();
                setFoodDetail(data);
            } catch (err) {
                if (err instanceof Error) setPageError(err.message);
                else setPageError('获取食品详情时发生未知错误');
                console.error(`获取食品详情 (${productId}) 错误:`, err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFoodDetail();
    }, [productId]);

    const connectWalletForVerification = async (): Promise<Signer | null> => {
        setVerification(prev => ({ ...prev, loading: true, error: null, message: "正在连接钱包..." }));
        const connection = await getProviderAndSigner();
        if (connection) {
            setSigner(connection.signer);
            setVerification(prev => ({ ...prev, loading: false, message: "钱包已连接。" }));
            antdMessage.success("钱包已连接");
            return connection.signer;
        }
        const errMsg = "连接钱包失败，无法验证链上哈希。";
        setVerification(prev => ({ ...prev, loading: false, error: errMsg, message: errMsg }));
        antdMessage.error(errMsg);
        return null;
    };

    const verifyHashOnChain = async () => {
        if (!foodDetail || !productId) return;
        setVerification({ loading: true, error: null, chainHash: null, verified: undefined, message: "正在从区块链读取哈希..." });
        antdMessage.loading({ content: '正在从区块链读取哈希...', key: 'verifying' });

        let currentSigner = signer;
        if (!currentSigner) {
            currentSigner = await connectWalletForVerification();
            if (!currentSigner) {
                antdMessage.destroy('verifying'); // 清除 loading 消息
                return;
            }
        }

        try {
            const contractInstance = getFoodTraceabilityContract(currentSigner);
            const hashFromChain = await contractInstance.getMetadataHash(productId);
            const isMatch = hashFromChain === foodDetail.onchain_metadata_hash;

            setVerification({
                loading: false,
                chainHash: hashFromChain,
                verified: isMatch,
                error: null,
                message: isMatch ? "链上哈希与数据库记录一致！数据可信。" : "警告：链上哈希与数据库记录不一致！",
            });
            if (isMatch) antdMessage.success({ content: '哈希验证一致！', key: 'verifying' });
            else antdMessage.warning({ content: '警告：哈希不一致！', key: 'verifying' });

        } catch (err: unknown) {
            console.error("从链上获取哈希失败:", err);
            let errMsg = "从链上获取哈希失败。";
            if (typeof err === 'object' && err !== null) {
                interface ChainError { message?: string; reason?: string; info?: { error?: { message?: string, code?: number } }; code?: number | string; }
                const error = err as ChainError;
                if (error.info?.error?.message) errMsg = `RPC 错误: ${error.info.error.message}`;
                else if (error.message) errMsg = error.message;
                if (error.code === 4001 || error.info?.error?.code === 4001) errMsg = "用户拒绝了钱包请求。";
            } else if (typeof err === 'string') errMsg = err;

            setVerification({ loading: false, error: errMsg, chainHash: null, verified: false, message: errMsg });
            antdMessage.error({ content: errMsg, key: 'verifying' });
        }
    };

    if (isLoading) {
        return <div style={{textAlign: 'center', marginTop: 50}}><Spin size="large" tip="正在加载食品详情..." /></div>;
    }

    if (pageError) {
        return (
            <Alert
                message="加载错误"
                description={pageError}
                type="error"
                showIcon
                action={
                    <Button type="primary" onClick={() => window.location.reload()}>
                        重试
                    </Button>
                }
                style={{margin: '20px auto', maxWidth: 600}}
            />
        );
    }

    if (!foodDetail) {
        return <Alert message="未找到数据" description={`无法找到产品ID为 "${productId}" 的食品数据。`} type="warning" showIcon />;
    }

    // Descriptions 组件的 items
    const coreInfoItems = [
        { key: '1', label: '产品ID (数据库)', children: <Text copyable>{foodDetail.product_id}</Text> },
        { key: '2', label: '链上元数据哈希', children: <Text copyable style={{wordBreak: 'break-all'}}>{foodDetail.onchain_metadata_hash}</Text> },
        { key: '3', label: '区块链交易哈希', children: <Text copyable style={{wordBreak: 'break-all'}}>{foodDetail.blockchain_transaction_hash}</Text> },
        { key: '4', label: '首次录入时间', children: new Date(foodDetail.created_at).toLocaleString('zh-CN') },
        { key: '5', label: '最后更新时间', children: new Date(foodDetail.updated_at).toLocaleString('zh-CN') },
    ];

    const metadataItems = Object.entries(foodDetail.metadata_json).map(([key, value], index) => {
        const displayLabels: Record<string, string> = {
            productId: '产品ID (元数据内)', productName: '产品名称', producerInfo: '生产商信息',
            productionDate: '生产日期', origin: '原产地', processingSteps: '加工流程描述',
        };
        return {
            key: `meta-${index}`,
            label: displayLabels[key] || key.charAt(0).toUpperCase() + key.slice(1), // 首字母大写
            children: value === null ? <Tag>N/A</Tag> : (typeof value === 'object' ? <pre style={{margin:0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(value, null, 2)}</pre> : String(value)),
            span: (key === 'processingSteps' && typeof value === 'string' && value.length > 50) ? 3 : 1, // 加工流程较长时占据整行
        };
    });
    return (
        <div>
            <Space style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={4} style={{ margin: 0 }}>
                    食品溯源详情: {foodDetail.metadata_json.productName as string || foodDetail.product_id}
                </Title>
                <Button icon={<RollbackOutlined />} onClick={() => window.history.back()}>
                    返回
                </Button>
            </Space>

            <Descriptions title="核心存证信息" bordered column={1} items={coreInfoItems} style={{ marginBottom: 24 }} />

            <Descriptions title="元数据详情 (来自数据库)" bordered column={{ xxl: 3, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }} items={metadataItems} style={{ marginBottom: 24 }} />

            <Divider />

            <Title level={5} style={{marginTop: 24}}>链上哈希验证</Title>
            <Paragraph type="secondary">
                通过连接您的 Metamask 钱包，可以直接从区块链读取该产品ID对应的元数据哈希，并与数据库中存储的哈希进行比对，以验证数据的原始性和一致性。
            </Paragraph>

            <Space direction="vertical" style={{width: '100%'}}>
                {!signer ? (
                    <Button type="primary" icon={<WalletOutlined />} onClick={connectWalletForVerification} loading={verification.loading}>
                        连接钱包以开始验证
                    </Button>
                ) : (
                    <Button icon={<SafetyCertificateOutlined />} onClick={verifyHashOnChain} loading={verification.loading} disabled={verification.loading}>
                        {verification.loading ? verification.message || '正在验证...' : '从区块链重新获取哈希并验证'}
                    </Button>
                )}

                {verification.loading && verification.message && <Text type="secondary">{verification.message}</Text>}

                {verification.chainHash && (
                    <Descriptions bordered column={1} size="small" style={{marginTop: 16}}>
                        <Descriptions.Item label="从区块链读取的哈希">
                            <Text copyable style={{wordBreak: 'break-all'}}>{verification.chainHash}</Text>
                        </Descriptions.Item>
                    </Descriptions>
                )}

                {verification.error && !verification.loading && (
                    <Alert message="验证出错" description={verification.error} type="error" showIcon />
                )}

                {!verification.loading && !verification.error && verification.chainHash && verification.verified !== undefined && (
                    verification.verified ? (
                        <Alert message="验证成功" description="链上哈希与数据库记录一致！数据可信。" type="success" showIcon icon={<CheckCircleOutlined />} />
                    ) : (
                        <Alert message="验证警告" description="链上哈希与数据库记录不一致！数据可能已被篡改或记录有误。" type="warning" showIcon icon={<WarningOutlined />} />
                    )
                )}
                 {!verification.loading && !verification.error && !verification.chainHash && verification.message && verification.message !== "钱包已连接。" && (
                    <Text type="secondary">{verification.message}</Text> // 显示初始提示或连接钱包后的消息
                )}
            </Space>
        </div>
    );
};

export default FoodDetailPage;
