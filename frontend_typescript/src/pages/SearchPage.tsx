import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Alert, Typography, Space, message as antdMessage } from 'antd'; // 引入 AntD 组件
import { SearchOutlined } from '@ant-design/icons'; // 引入图标

const { Title } = Typography;

const SearchPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // const [message, setMessage] = useState<string | null>(null); // 使用 antdMessage 和 Alert
    const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('');

    const navigate = useNavigate();

    const handleSearch = async (event?: React.FormEvent) => { // 使 event 可选，因为 Input.Search 的 onSearch 不带 event
        event?.preventDefault(); // 如果是通过 form 提交，则阻止默认行为
        const trimmedSearchTerm = searchTerm.trim();

        if (!trimmedSearchTerm) {
            antdMessage.warning('请输入要搜索的产品ID。');
            setSearchStatus('idle');
            setStatusMessage('请输入产品ID。');
            return;
        }

        setIsLoading(true);
        setSearchStatus('loading');
        setStatusMessage(`正在搜索产品ID: ${trimmedSearchTerm}...`);
        antdMessage.loading({ content: '正在搜索...', key: 'searching', duration: 0 });

        try {
            const response = await fetch(`/api/food-records/${trimmedSearchTerm}`);

            if (response.ok) {
                antdMessage.success({ content: `找到产品 ${trimmedSearchTerm}，正在跳转...`, key: 'searching' });
                setSearchStatus('found');
                setStatusMessage(`找到产品ID: ${trimmedSearchTerm}，正在跳转到详情页...`);
                setTimeout(() => {
                    navigate(`/food/${trimmedSearchTerm}`);
                }, 600); // 稍微延迟一下让用户看到消息
            } else if (response.status === 404) {
                antdMessage.error({ content: `未找到产品 ${trimmedSearchTerm}`, key: 'searching' });
                setSearchStatus('not_found');
                setStatusMessage(`未找到产品ID为 "${trimmedSearchTerm}" 的食品记录。`);
            } else {
                const errorData = await response.json().catch(() => ({ message: `搜索失败，服务器返回状态: ${response.status}` }));
                throw new Error(errorData.message || `搜索失败，服务器返回状态: ${response.status}`);
            }
        } catch (err) {
            console.error("搜索产品时发生错误:", err);
            let errMsg = '搜索时发生未知错误。';
            if (err instanceof Error) {
                errMsg = err.message;
            }
            antdMessage.error({ content: `搜索失败: ${errMsg}`, key: 'searching' });
            setSearchStatus('error');
            setStatusMessage(`搜索错误: ${errMsg}`);
        } finally {
            // setIsLoading(false); // antdMessage.destroy() 会处理 loading 状态的 message, isLoading 控制按钮状态
             if (searchStatus !== 'found') { // 如果不是正在跳转，则恢复按钮状态
                 setIsLoading(false);
             }
        }
    };

    // Input.Search 的 onSearch 回调不带 event 参数
    const onSearchInputChange = (value: string) => {
        setSearchTerm(value);
        // 可以选择在这里直接调用搜索，或者让用户点击按钮
        // 即：输入后立即搜索与手动点击
        // if (value.trim()) handleSearch();    // 自动
    }

    return (
        <div>
            <Title level={4} style={{ marginBottom: 24 }}>搜索食品溯源信息</Title>

            <Space direction="vertical" style={{ width: '100%' }}>
                <Input.Search
                    placeholder="输入产品ID进行搜索..."
                    enterButton={<Button type="primary" icon={<SearchOutlined />} loading={isLoading}>搜索</Button>}
                    size="large"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} // 实时更新 searchTerm
                    onSearch={() => handleSearch()} // 点击搜索按钮或回车时触发
                    loading={isLoading}
                    disabled={isLoading}
                />

                {searchStatus === 'loading' && statusMessage && (
                    <Alert message="搜索中" description={statusMessage} type="info" showIcon />
                )}
                {searchStatus === 'found' && statusMessage && (
                    <Alert message="找到记录" description={statusMessage} type="success" showIcon />
                )}
                {searchStatus === 'not_found' && statusMessage && (
                    <Alert message="未找到" description={statusMessage} type="warning" showIcon />
                )}
                {searchStatus === 'error' && statusMessage && (
                    <Alert message="搜索错误" description={statusMessage} type="error" showIcon />
                )}
                {searchStatus === 'idle' && statusMessage && ( // 用于初始的“请输入ID”提示
                     <Alert message="提示" description={statusMessage} type="info" showIcon />
                )}
            </Space>
        </div>
    );
};

export default SearchPage;
