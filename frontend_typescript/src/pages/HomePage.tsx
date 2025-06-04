// food_traceability_platform/frontend_typescript/src/pages/HomePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // 使用 useNavigate 替代 Link 进行编程式导航
import { Table, Button, Space, Tooltip, Spin, Alert, Typography, Tag } from 'antd'; // 引入 AntD 组件
import { EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'; // 引入图标

const { Title, Text } = Typography;

// 定义从后端获取的食品列表项的类型
interface FoodListItemFromAPI {
    product_id: string;
    onchain_metadata_hash: string;
    created_at: string; // 后端返回的是 ISO 格式字符串
    product_name: string | null;
}

// 定义 Table 组件的列配置
// RecordType 就是 FoodListItemFromAPI
const columns = (navigate: ReturnType<typeof useNavigate>) => [ // 将 navigate 作为参数传入
    {
        title: '产品ID (批次号)',
        dataIndex: 'product_id',
        key: 'product_id',
        // sorter: (a: FoodListItemFromAPI, b: FoodListItemFromAPI) => a.product_id.localeCompare(b.product_id),
        render: (text: string) => <Text copyable={{ text: text }}>{text}</Text>, // 添加可复制功能
    },
    {
        title: '产品名称',
        dataIndex: 'product_name',
        key: 'product_name',
        render: (name: string | null) => name || <Tag color="orange">N/A</Tag>, // 如果为 null 显示 N/A 标签
        // sorter: (a: FoodListItemFromAPI, b: FoodListItemFromAPI) => (a.product_name || '').localeCompare(b.product_name || ''),
    },
    {
        title: '链上元数据哈希',
        dataIndex: 'onchain_metadata_hash',
        key: 'onchain_metadata_hash',
        ellipsis: true, // 超出长度显示省略号
        render: (hash: string) => (
            <Tooltip title={hash}>
                <Text copyable={{ text: hash }}>{hash}</Text>
            </Tooltip>
        ),
    },
    {
        title: '录入时间',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (dateString: string) => new Date(dateString).toLocaleString('zh-CN'),
        sorter: (a: FoodListItemFromAPI, b: FoodListItemFromAPI) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        defaultSortOrder: 'descend' as const, // 默认按时间降序
    },
    {
        title: '操作',
        key: 'action',
        // dataIndex: undefined, // 操作列通常没有 dataIndex
        render: (_text: unknown, record: FoodListItemFromAPI, _index: number) => ( // 修改点: _text 类型为 unknown, 也可以加上 _index
            <Space size="middle">
                <Tooltip title="查看详情">
                    <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/food/${record.product_id}`)}
                    >
                        详情
                    </Button>
                </Tooltip>
                {/* 如果未来有更多操作按钮，可以继续在这里添加 */}
            </Space>
        ),
    },
];

const HomePage: React.FC = () => {
    const [foodList, setFoodList] = useState<FoodListItemFromAPI[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate(); // 获取 navigate 函数

    useEffect(() => {
            const fetchFoodList = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const response = await fetch('/api/food-records');
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: `获取食品列表失败: ${response.statusText} (状态码: ${response.status})` }));
                        throw new Error(errorData.message || `获取食品列表失败: ${response.statusText} (状态码: ${response.status})`);
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
        }, []);

    // 导航按钮的处理函数
    const handleNavigate = (path: string) => {
        navigate(path);
    };
    if (error) { // 优先显示错误
        return <Alert message="加载错误" description={error} type="error" showIcon closable />;
    }

    return (
            <div>
                <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>食品溯源记录</Title>
                    <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleNavigate('/add-food')}>
                            录入新食品
                        </Button>
                        <Button icon={<SearchOutlined />} onClick={() => handleNavigate('/search')}>
                            搜索食品
                        </Button>
                    </Space>
                </Space>

                <Spin spinning={isLoading} tip="正在加载数据...">
                    <Table
                        columns={columns(navigate)} // 将 navigate 传递给 columns 函数
                        dataSource={foodList}
                        rowKey="product_id" // 指定每行的唯一 key
                        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }} // 添加分页配置
                        bordered // 添加边框
                        size="middle" // 表格尺寸
                        scroll={{ x: 'max-content' }} // 水平滚动，当内容超出时
                    />
                </Spin>
                {foodList.length === 0 && !isLoading && !error && ( // 仅在非加载、无错误且列表为空时显示
                    <Alert message="提示" description="目前还没有食品溯源记录。" type="info" showIcon />
                )}
            </div>
        );
    };

// const tableHeaderStyle: React.CSSProperties = {
//     border: '1px solid #ddd',
//     padding: '8px',
//     textAlign: 'left',
//     backgroundColor: '#f2f2f2',
// };

// const tableCellStyle: React.CSSProperties = {
//     border: '1px solid #ddd',
//     padding: '8px',
//     textAlign: 'left',
// };

export default HomePage;
