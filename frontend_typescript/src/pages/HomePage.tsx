// food_traceability_platform/frontend_typescript/src/pages/HomePage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// 定义从后端获取的食品列表项的类型
interface FoodListItemFromAPI {
    product_id: string;
    onchain_metadata_hash: string;
    created_at: string; // 后端返回的是 ISO 格式字符串
    // 如果后端API将来返回 productName，在这里添加
    // productName?: string;
}

const HomePage: React.FC = () => {
    const [foodList, setFoodList] = useState<FoodListItemFromAPI[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFoodList = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // 使用 Vite 代理路径 (如果配置了) 或完整 URL
                const response = await fetch('/api/food-records'); // 假设 Vite 代理已配置
                if (!response.ok) {
                    throw new Error(`获取食品列表失败: ${response.statusText} (状态码: ${response.status})`);
                }
                const data: FoodListItemFromAPI[] = await response.json();
                setFoodList(data);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('获取食品列表时发生未知错误');
                }
                console.error("获取食品列表错误:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFoodList();
    }, []); // 空依赖数组，确保只在组件挂载时调用一次

    if (isLoading) {
        return <div>正在加载食品列表...</div>;
    }

    if (error) {
        return <div style={{ color: 'red' }}>错误: {error}</div>;
    }

    return (
        <div>
            <h2>食品溯源记录列表</h2>
            <nav style={{ marginBottom: '20px' }}>
                <Link to="/add-food" style={{ marginRight: '10px' }}>录入新食品</Link>
                <Link to="/search">搜索食品信息</Link>
            </nav>

            {foodList.length === 0 ? (
                <p>目前还没有食品溯源记录。</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>产品ID (批次号)</th>
                            {/* <th>产品名称</th> (如果后端返回了 productName) */}
                            <th style={tableHeaderStyle}>链上元数据哈希</th>
                            <th style={tableHeaderStyle}>录入时间</th>
                            <th style={tableHeaderStyle}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {foodList.map((food) => (
                            <tr key={food.product_id}>
                                <td style={tableCellStyle}>{food.product_id}</td>
                                {/* <td>{food.productName || 'N/A'}</td> */}
                                <td style={tableCellStyle} title={food.onchain_metadata_hash}>
                                    {food.onchain_metadata_hash.substring(0, 10)}...
                                </td>
                                <td style={tableCellStyle}>{new Date(food.created_at).toLocaleString('zh-CN')}</td>
                                <td style={tableCellStyle}>
                                    <Link to={`/food/${food.product_id}`}>查看详情</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

// 简单的内联样式 (可以提取到 CSS 文件)
const tableHeaderStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2',
};

const tableCellStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left',
};

export default HomePage;
