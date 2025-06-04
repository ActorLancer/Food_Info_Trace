// food_traceability_platform/frontend_typescript/src/pages/SearchPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string | null>(null); // 用于显示成功、失败或提示信息
    const navigate = useNavigate();

    const handleSearch = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedSearchTerm = searchTerm.trim();

        if (!trimmedSearchTerm) {
            setMessage('请输入要搜索的产品ID。');
            return;
        }

        setIsLoading(true);
        setMessage(null); // 清除之前的消息

        try {
            // 调用后端 API 检查产品是否存在并获取基本信息（虽然我们只需要知道它是否存在）
            const response = await fetch(`/api/food-records/${trimmedSearchTerm}`);

            if (response.ok) { // HTTP 状态码 2xx，表示产品存在
                // const data = await response.json(); // 可以选择性地获取数据，但这里我们只需要确认存在
                // console.log("产品存在:", data);
                setMessage(`找到产品ID: ${trimmedSearchTerm}，正在跳转到详情页...`);
                // 延迟一小段时间让用户看到消息，然后跳转
                setTimeout(() => {
                    navigate(`/food/${trimmedSearchTerm}`);
                }, 1500);
            } else if (response.status === 404) {
                // 后端返回 404 Not Found
                setMessage(`未找到产品ID为 "${trimmedSearchTerm}" 的食品记录。`);
            } else {
                // 其他错误状态码
                const errorData = await response.json().catch(() => ({ message: `搜索失败，服务器返回状态: ${response.status}` }));
                throw new Error(errorData.message || `搜索失败，服务器返回状态: ${response.status}`);
            }
        } catch (err) {
            console.error("搜索产品时发生错误:", err);
            if (err instanceof Error) {
                setMessage(`错误: ${err.message}`);
            } else {
                setMessage('搜索时发生未知错误。');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2>搜索食品溯源信息</h2>
            <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="输入产品ID进行搜索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ marginRight: '10px', padding: '8px', minWidth: '300px' }}
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
                    {isLoading ? '正在搜索...' : '搜索'}
                </button>
            </form>

            {message && (
                <p style={{
                    color: message.startsWith('错误') || message.includes('未找到') ? 'red' : 'green',
                    marginTop: '10px'
                }}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default SearchPage;
