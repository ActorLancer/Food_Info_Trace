// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <div>
//         <a href="https://vite.dev" target="_blank">
//           <img src={viteLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>Vite + React</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.tsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

// export default App
// food_traceability_platform/frontend_typescript/src/App.tsx
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import zhCN from 'antd/locale/zh_CN'; // 导入中文语言包
import dayjs from 'dayjs'; // AntD 日期组件依赖 dayjs
import 'dayjs/locale/zh-cn'; // 导入 dayjs 的中文语言配置
dayjs.locale('zh-cn'); // 全局设置 dayjs 的语言为中文

import { Layout, Menu, Typography, theme as antdTheme, ConfigProvider } from 'antd'; // 引入 ConfigProvider
// import { HomeOutlined, FormOutlined, SearchOutlined, BarChartOutlined } from '@ant-design/icons'; // 引入图标
import { HomeOutlined, FormOutlined, SearchOutlined } from '@ant-design/icons'; // 引入图标
// import './App.css'; // 您可以保留或清空这个文件

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

// 定义菜单项
const menuItems = [
    {
        key: '/',
        icon: <HomeOutlined />,
        label: '首页 (记录列表)',
    },
    {
        key: '/add-food',
        icon: <FormOutlined />,
        label: '录入新食品',
    },
    {
        key: '/search',
        icon: <SearchOutlined />,
        label: '搜索食品',
    },
    // 可以添加更多菜单项，例如统计分析等
    // {
    //   key: '/analytics',
    //   icon: <BarChartOutlined />,
    //   label: '统计分析',
    // },
];

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false); // 侧边栏收起状态

    // Ant Design v5 的主题 token
    const {
        token: { colorBgContainer, borderRadiusLG, colorPrimary },
    } = antdTheme.useToken();

    const handleMenuClick = (e: { key: string }) => {
        navigate(e.key);
    };

    // 获取当前选中的菜单项的 key
    // 确保即使是子路由也能正确高亮父菜单
    const getCurrentSelectedKey = () => {
        // 对于 /food/:productId 这样的详情页，我们希望仍然高亮 '/' (首页/列表页)
        if (location.pathname.startsWith('/food/')) {
            return ['/'];
        }
        const currentPath = menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(item.key + '/'));
        return currentPath ? [currentPath.key] : ['/']; // 默认高亮首页
    };
    return (
        // ConfigProvider 用于配置 Ant Design 的全局特性，比如中文语言包
        <ConfigProvider
            locale={zhCN} // 设置中文语言包
            theme={{
                // token: { colorPrimary: '#00b96b' }, // 例如，自定义主题色
            }}
            // 如果需要中文语言包 (antd 默认是英文，但很多组件内文本是中文或无文本)
            // locale={zhCN} // 需要 import zhCN from 'antd/locale/zh_CN';
        >
            <Layout style={{ minHeight: '100vh' }}>
                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                    <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white', borderRadius: '6px' }}>
                       {collapsed ? '溯源' : '食品溯源平台'}
                    </div>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={getCurrentSelectedKey()}
                        items={menuItems}
                        onClick={handleMenuClick}
                    />
                </Sider>
                <Layout>
                    <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center' }}>
                        <Title level={3} style={{ margin: 0, color: colorPrimary }}>食品溯源信息管理</Title>
                    </Header>
                    <Content style={{ margin: '16px' }}>
                        <div
                            style={{
                                padding: 24,
                                minHeight: 360,
                                background: colorBgContainer,
                                borderRadius: borderRadiusLG,
                            }}
                        >
                            <Outlet /> {/* 子路由对应的组件会在这里渲染 */}
                        </div>
                    </Content>
                    <Footer style={{ textAlign: 'center' }}>
                        食品溯源平台 ©{new Date().getFullYear()} CBy Luna
                    </Footer>
                </Layout>
            </Layout>
        </ConfigProvider>
    );
};

export default App;
