import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // 使用 useNavigate 替代 Link 进行编程式导航
import { Table, Button, Space, Tooltip, Spin, Alert, Typography, Tag, type TableProps } from 'antd'; // 引入 AntD 组件
import { EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'; // 引入图标

const { Title, Text } = Typography;

// 定义从后端获取的食品列表项的类型
interface FoodListItemFromAPI {
    product_id: string;
    onchain_metadata_hash: string;
    created_at: string; // 后端返回的是 ISO 格式字符串
    product_name: string | null;
}

// 定义后端分页响应的完整结构
interface PaginatedApiResponse {
    items: FoodListItemFromAPI[];
    total_items: number;
    page: number;
    page_size: number;
    total_pages: number;
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
        // sortDirections: ['descend', 'ascend'], // 只允许降序和升序
        defaultSortOrder: 'descend' as const, // 保持默认降序
        // Ge-Ai:
        // 如果希望初始是降序，点击后变升序，再点击回降序，可以这样设置
        // 或者，如果希望初始不排序，点击第一次是降序（或升序），再点击是另一种，则可以去掉 defaultSortOrder，
        // 并可能需要在 Table 的 onChange 中管理 sortOrder 状态。
        // 但对于两态切换，通常 defaultSortOrder 配合受控的 sortOrder (如果需要更精细控制) 或非受控行为效果更好。
        // 我们先尝试非受控行为，仅限制 sortDirections。
    },
    {
        title: '操作',
        key: 'action',
        // dataIndex: undefined, // 操作列 dataIndex
        render: (_text: unknown, record: FoodListItemFromAPI, _index: number) => (
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
                {/* 未来坑能会有更多操作按钮，继续在这里添加 */}
            </Space>
        ),
    },
];

const HomePage: React.FC = () => {
    const [foodList, setFoodList] = useState<FoodListItemFromAPI[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate(); // 获取 navigate 函数

    // 新增分页状态
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10, // 与后端默认值一致
        total: 0,     // 总记录数
    });

    // fetchFoodList 函数需要接受分页参数
    const fetchFoodList = async (page: number = pagination.current, pageSize: number = pagination.pageSize) => {
        setIsLoading(true);
        setError(null);
        try {
            // 在 URL 中添加分页参数
            const response = await fetch(`/api/food-records?page=${page}&page_size=${pageSize}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `获取食品列表失败: ${response.statusText} (状态码: ${response.status})` }));
                throw new Error(errorData.message || `获取食品列表失败: ${response.statusText} (状态码: ${response.status})`);
            }
            const data: PaginatedApiResponse = await response.json(); // md 点1: 期望 PaginatedApiResponse 类型

            setFoodList(data.items); // md 点2: 使用 data.items 设置列表
            setPagination(prev => ({ // 修改点3: 更新分页状态
                ...prev,
                current: data.page,
                pageSize: data.page_size,
                total: data.total_items,
            }));

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

    useEffect(() => {
        fetchFoodList(pagination.current, pagination.pageSize); // 初始加载时使用默认分页参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 导航按钮的处理函数
    const handleNavigate = (path: string) => {
        navigate(path);
    };

    // AntD Table 的 onChange 事件处理器，用于处理分页、排序、筛选变化
    const handleTableChange: TableProps<FoodListItemFromAPI>['onChange'] = (
        newPagination,
        _filters, // 我们暂时不使用筛选
        _sorter   // 我们暂时让 Table 自身处理排序，如果需要服务器端排序则需处理此参数
    ) => {
        // 当页码或每页数量变化时，重新获取数据
        if (newPagination.current && newPagination.pageSize) {
             // 更新本地分页状态，并触发数据重新获取
            // setPagination(prev => ({
            //     ...prev,
            //     current: newPagination.current || 1,
            //     pageSize: newPagination.pageSize || 10,
            // }));
            // 直接调用 fetchFoodList，它会更新状态
            fetchFoodList(newPagination.current, newPagination.pageSize);
        }
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
                    {/* <Table
                        columns={columns(navigate)}
                        dataSource={foodList}
                        rowKey="product_id"
                        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }} // 添加分页配置
                        bordered
                        size="middle"
                        scroll={{ x: 'max-content' }}
                    /> */}
                    <Table
                        columns={columns(navigate)} // 将 navigate 传递给 columns 函数
                        dataSource={foodList} // dataSource 现在是正确的数组了
                        rowKey="product_id" // 指定每行的唯一 key
                        pagination={{ // md 点4: 将 Table 的分页与我们的 state 联动
                            current: pagination.current,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            showSizeChanger: true,
                            pageSizeOptions: ['5', '10', '20', '50'], // 可以自定义每页数量选项
                            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                        }}
                        onChange={handleTableChange} // md 点5: 添加 onChange 处理器
                        bordered    // 添加边框
                        size="middle"   // 表格尺寸
                        scroll={{ x: 'max-content' }}   // 水平滚动，当内容超出时
                    />
                </Spin>
                {foodList.length === 0 && !isLoading && !error && ( // 仅在非加载、无错误且列表为空时显示
                    <Alert message="提示" description="目前还没有食品溯源记录。" type="info" showIcon />
                )}
            </div>
        );
    };

export default HomePage;
