// food_traceability_platform/frontend_typescript/src/pages/AddFoodPage.tsx
import React, { useState, useEffect } from 'react';
import { type Signer, type Contract, type Eip1193Provider } from 'ethers';
import {
    Form, Input, Button, DatePicker, Spin, Alert, Typography, Space, message as antdMessage, Tag, // 添加 Tag
    // type FormProps // 如果用到
} from 'antd'; // 引入 AntD 组件
import { WalletOutlined, CloudUploadOutlined, /* CheckCircleOutlined, WarningOutlined */ } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs'; // Dayjs 只作用类型
import type { ValidateErrorEntity } from 'rc-field-form/lib/interface'; // 用于 onFinishFailed
import { getProviderAndSigner, getFoodTraceabilityContract, calculateMetadataHash } from '../utils/blockchain';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn'); // 全局设置

const { Title, Text } = Typography;
const { TextArea } = Input; // 如果需要多行文本输入

// 声明 window.ethereum 的类型
declare global {
    interface Window {
        ethereum?: Eip1193Provider & { // 使用 Eip1193Provider 并添加 Metamask 特有的属性
            isMetaMask?: boolean;
            selectedAddress?: string | null;
        };
    }
}

// 定义表单数据的接口 (与之前一致，但 DatePicker 返回的是 Dayjs 对象)
interface FoodFormAntdData {
    productId: string;
    productName: string;
    producerInfo: string;
    productionDate: Dayjs | null; // AntD DatePicker 返回 Dayjs 对象
    origin: string;
    // processingSteps?: string; // 示例：加工流程，使用 TextArea
}

// 用于提交到元数据和后端的纯数据对象
interface FoodMetadata {
    productId: string;
    productName: string;
    producerInfo: string;
    productionDate: string; // 存储为 ISO 格式字符串
    origin: string;
    // processingSteps?: string;
}
const AddFoodPage: React.FC = () => {
    const [form] = Form.useForm<FoodFormAntdData>(); // AntD Form hook
    const [signer, setSigner] = useState<Signer | null>(null);
    const [signerAddress, setSignerAddress] = useState<string | null>(null);
    const [contract, setContract] = useState<Contract | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // const [message, setMessage] = useState<string>(''); // 使用 antdMessage 替代
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const connectWallet = async () => {
        setIsLoading(true);
        // setMessage('');
        setSubmissionStatus('idle');
        setStatusMessage('');
        const connection = await getProviderAndSigner();
        if (connection) {
            setSigner(connection.signer);
            setSignerAddress(connection.signerAddress);
            const foodContract = getFoodTraceabilityContract(connection.signer);
            setContract(foodContract);
            antdMessage.success(`钱包已连接: ${connection.signerAddress.substring(0,6)}...${connection.signerAddress.substring(connection.signerAddress.length - 4)}`);
        } else {
            antdMessage.error('连接钱包失败。');
        }
        setIsLoading(false);
    };

    // 页面加载时尝试自动连接
    useEffect(() => {
        if (window.ethereum?.isMetaMask && window.ethereum.selectedAddress) {
             connectWallet();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onFinish = async (values: FoodFormAntdData) => {
        if (!signer || !contract) {
            antdMessage.error('请先连接钱包。');
            return;
        }
        console.log('表单提交数据 (AntD):', values);
        setIsLoading(true);
        setSubmissionStatus('processing');
        setStatusMessage('正在处理提交...');
        antdMessage.loading({ content: '正在处理，请稍候...', key: 'submitting' });
        // 将 Dayjs 对象转换为 ISO 字符串，并准备元数据
        const metadataToSubmit: FoodMetadata = {
            ...values,
            productionDate: values.productionDate ? values.productionDate.toISOString() : '',
        };

        try {
            // 1. 准备元数据并计算哈希
            const metadataHash = calculateMetadataHash(metadataToSubmit);
            console.log("元数据 (提交用):", metadataToSubmit);
            console.log("元数据哈希 (前端计算):", metadataHash);
            setStatusMessage('哈希计算完成，正在请求 Metamask 授权交易...');

            // 2. 调用智能合约的 addRecord 方法
            const tx = await contract.addRecord(metadataToSubmit.productId, metadataHash);
            setStatusMessage('交易已发送，等待区块链确认...');
            console.log("交易发送:", tx);
            antdMessage.loading({ content: '交易已发送，等待确认...', key: 'submitting', duration: 0 });
            const receipt = await tx.wait();
            console.log("交易回执:", receipt);

            if (receipt.status === 0) {
                throw new Error("区块链交易执行失败，请检查交易详情或余额。");
            }

            const transactionHash = receipt.hash;
            setStatusMessage(`数据哈希已成功上链！交易哈希: ${transactionHash.substring(0,10)}...`);
            antdMessage.loading({ content: '数据已上链，正在发送到后端...', key: 'submitting', duration: 0 });
            // 3. 将元数据和交易信息发送到后端进行持久化
            const backendPayload = {
                productId: metadataToSubmit.productId,
                metadata: metadataToSubmit, // 发送转换后的元数据
                metadataHashOnChain: metadataHash,
                transactionHash: transactionHash,
            };
            console.log("准备发送到后端的数据:", backendPayload);

            const backendUrl = '/api/food-records';
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backendPayload),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `后端请求失败，状态码: ${response.status}`);
            }

            console.log("后端响应:", responseData);
            antdMessage.success({ content: `数据成功录入并持久化！产品ID: ${metadataToSubmit.productId}`, key: 'submitting', duration: 3 });
            setSubmissionStatus('success');
            setStatusMessage(`数据成功录入并持久化！产品ID: ${metadataToSubmit.productId}. ${responseData.message || ''}`);
            form.resetFields(); // 成功后清空表单

        } catch (err: unknown) {
            console.error("处理失败:", err);
            setSubmissionStatus('error');
            let displayMessage = "发生未知错误，请查看控制台。";
            if (typeof err === 'object' && err !== null) {
                interface AppError {
                    message?: string; data?: { message?: string }; reason?: string;
                    code?: number | string; error?: { code?: number; message?: string; data?: unknown; };
                    info?: { error?: { code?: number; message?: string; data?: unknown; }; [key: string]: unknown; };
                }
                const error = err as AppError;
                if (error.info?.error?.message) displayMessage = `RPC 错误: ${error.info.error.message}`;
                else if (error.reason) displayMessage = `合约调用错误: ${error.reason}`;
                else if (error.data?.message) displayMessage = `Metamask 错误: ${error.data.message}`;
                else if (error.error?.message) displayMessage = `错误: ${error.error.message}`;
                else if (error.message) displayMessage = error.message;
                if (error.code === 4001 || error.info?.error?.code === 4001) displayMessage = "用户拒绝了钱包请求。";
            } else if (typeof err === 'string') {
                displayMessage = err;
            }
            antdMessage.error({ content: `处理失败: ${displayMessage}`, key: 'submitting', duration: 5 });
            setStatusMessage(`处理失败: ${displayMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const onFinishFailed = (errorInfo: ValidateErrorEntity<FoodFormAntdData>) => {
        console.log('表单校验失败:', errorInfo);
        antdMessage.error('请检查表单输入项！');
        errorInfo.errorFields.forEach(field => {
            if (field.errors && field.errors.length > 0) {
                console.error(`字段 ${Array.isArray(field.name) ? field.name.join('.') : field.name} 错误: ${field.errors.join(', ')}`);
            }
        });
    };

    // 表单布局
    const formItemLayout = {
        labelCol: { span: 6 }, // 标签占据的栅格宽度
        wrapperCol: { span: 14 }, // 输入控件占据的栅格宽度
    };
    const tailFormItemLayout = {
        wrapperCol: { offset: 6, span: 14 },
    };

    return (
        <div>
            <Title level={4} style={{ marginBottom: 24 }}>录入新食品信息</Title>

            {!signerAddress ? (
                <Space direction="vertical" align="center" style={{width: '100%'}}>
                    <Button type="primary" icon={<WalletOutlined />} onClick={connectWallet} loading={isLoading} size="large">
                        连接 Metamask 钱包
                    </Button>
                    <Text type="secondary">需要连接钱包才能录入数据。</Text>
                </Space>
            ) : (
                <Text style={{ marginBottom: 16, display: 'block' }}>
                    已连接钱包: <Tag color="blue">{signerAddress}</Tag>
                    <Button type="link" onClick={() => { setSigner(null); setSignerAddress(null); setContract(null); /*setMessage('');*/ setSubmissionStatus('idle'); setStatusMessage(''); form.resetFields(); }}>
                        断开钱包
                    </Button>
                </Text>
            )}

            {/* {message && <Alert message={message.startsWith('错误') || message.startsWith('Metamask 错误') ? "错误" : "提示"} description={message} type={message.startsWith('错误') || message.startsWith('Metamask 错误') ? "error" : "info"} showIcon style={{ marginBottom: 16 }} />} */}

            {submissionStatus === 'processing' && <Spin tip={statusMessage} style={{display: 'block', marginBottom: 16}}><Alert message="处理中" description={statusMessage} type="info" /></Spin>}
            {submissionStatus === 'success' && <Alert message="成功" description={statusMessage} type="success" showIcon style={{ marginBottom: 16 }} />}
            {submissionStatus === 'error' && <Alert message="失败" description={statusMessage} type="error" showIcon style={{ marginBottom: 16 }} />}
            {signerAddress && (
                <Form
                    {...formItemLayout}
                    form={form}
                    name="add_food_form"
                    onFinish={onFinish}
                    onFinishFailed={onFinishFailed}
                    autoComplete="off"
                    disabled={isLoading} // 表单在加载时禁用
                >
                    <Form.Item
                        label="产品ID (批次号)"
                        name="productId"
                        rules={[{ required: true, message: '请输入产品ID!' }, {pattern: /^[a-zA-Z0-9-_]+$/, message: '产品ID只能包含字母、数字、下划线和短横线'}]}
                    >
                        <Input placeholder="例如：BATCH001"/>
                    </Form.Item>

                    <Form.Item
                        label="产品名称"
                        name="productName"
                        rules={[{ required: true, message: '请输入产品名称!' }]}
                    >
                        <Input placeholder="例如：有机番茄"/>
                    </Form.Item>

                    <Form.Item
                        label="生产商信息"
                        name="producerInfo"
                    >
                        <Input placeholder="例如：快乐农场"/>
                    </Form.Item>

                    <Form.Item
                        label="生产日期"
                        name="productionDate"
                    >
                        <DatePicker style={{ width: '100%' }} placeholder="选择生产日期"/>
                    </Form.Item>

                    <Form.Item
                        label="原产地"
                        name="origin"
                    >
                        <Input placeholder="例如：本地农场"/>
                    </Form.Item>

                    {/* 示例: 加工流程 (多行文本)
                    <Form.Item
                        label="加工流程描述"
                        name="processingSteps"
                    >
                        <TextArea rows={4} placeholder="描述主要的加工或处理步骤..."/>
                    </Form.Item>
                    */}

                    <Form.Item {...tailFormItemLayout}>
                        <Button type="primary" htmlType="submit" loading={isLoading} icon={<CloudUploadOutlined />}>
                            {isLoading ? '正在提交...' : '提交到区块链并保存'}
                        </Button>
                    </Form.Item>
                </Form>
            )}
        </div>
    );
};

export default AddFoodPage;
