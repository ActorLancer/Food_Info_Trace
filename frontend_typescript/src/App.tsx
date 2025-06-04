// export default App
import React, { useState, useEffect } from 'react';
import { ethers, type Eip1193Provider } from 'ethers';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import zhCN from 'antd/locale/zh_CN'; // 导入中文语言包
import dayjs from 'dayjs'; // AntD 日期组件依赖 dayjs
import 'dayjs/locale/zh-cn'; // 导入 dayjs 的中文语言配置
dayjs.locale('zh-cn'); // 全局设置 dayjs 的语言为中文

import { Layout, Menu, Typography, theme as antdTheme, ConfigProvider, Modal, Button as AntdButton, message as antdMessage} from 'antd'; // 引入 ConfigProvider
// import { HomeOutlined, FormOutlined, SearchOutlined, BarChartOutlined } from '@ant-design/icons'; // 引入图标
import { HomeOutlined, FormOutlined, SearchOutlined } from '@ant-design/icons'; // 引入图标

// (EXPECTED_CHAIN_ID 等常量从 utils/blockchain.ts 导入或在这里重新定义)
// 最好是从 utils/blockchain.ts 导出并在这里导入，以保持一致性
import {
  EXPECTED_CHAIN_ID as APP_EXPECTED_CHAIN_ID,
  EXPECTED_NETWORK_NAME as APP_EXPECTED_NETWORK_NAME,
} from './utils/blockchain';

// 如果这里选择硬编码，但实际项目中应共享
// const APP_EXPECTED_CHAIN_ID = "0x539"; // 与 utils/blockchain.ts 中的一致
// const APP_EXPECTED_NETWORK_NAME = "Hardhat Local";

// 声明 window.ethereum 的类型
declare global {
    interface Window {
        ethereum?: Eip1193Provider & { // 使用 Eip1193Provider 并添加 Metamask 特有的属性
            isMetaMask?: boolean;
            selectedAddress?: string | null;
            on: (event: string, handler: (...args: any[]) => void) => void; // 添加 on 方法签名
            removeListener: (event: string, handler: (...args: any[]) => void) => void; // 添加 removeListener 方法签名
        };
    }
}

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
    // TODO: 可以添加更多菜单项，例如统计分析等
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
    const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
    const [currentChainId, setCurrentChainId] = useState<string | null>(null);

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
        // 对于 /food/:productId 这样的详情页，希望仍然高亮 '/' (首页/列表页)
        if (location.pathname.startsWith('/food/')) {
            return ['/'];
        }
        const currentPath = menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(item.key + '/'));
        return currentPath ? [currentPath.key] : ['/']; // 默认高亮首页
    };

    // TODO: 添加一个全局的 signerAddress state，如果很多组件都需要它
    // 或者让每个需要 signerAddress 的组件自己通过 connectWallet 获取
    useEffect(() => {
        const { ethereum } = window;
        if (ethereum && ethereum.isMetaMask) {
            // 初始网络检查
            const checkNetwork = async () => {
                try {
                    const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
                    setCurrentChainId(chainId);
                    if (chainId !== APP_EXPECTED_CHAIN_ID) {
                        setIsWrongNetwork(true);
                        console.warn(`网络不匹配: 当前 ${chainId}, 期望 ${APP_EXPECTED_CHAIN_ID}`);
                    } else {
                        setIsWrongNetwork(false);
                    }
                } catch (err) {
                    console.error("检查网络失败:", err);
                    // 可能 Metamask 未连接或有问题
                }
            };
            checkNetwork();

            // 监听网络变化事件
            const handleChainChanged = (newChainId: string) => {
                console.log('网络已切换:', newChainId);
                setCurrentChainId(newChainId);
                if (newChainId !== APP_EXPECTED_CHAIN_ID) {
                    setIsWrongNetwork(true);
                    // 可以选择强制刷新页面，因为网络切换可能导致之前的状态失效
                    // window.location.reload();
                    // 或者只是显示提示
                } else {
                    setIsWrongNetwork(false);
                    // 如果之前是错误网络，现在切换回来了，可以考虑自动刷新或提示用户
                    // window.location.reload(); // 切换回正确网络后刷新以确保状态一致
                }
            };

            ethereum.on('chainChanged', handleChainChanged);

            // 监听账户变化事件
            const handleAccountsChanged = (accounts: string[]) => {
                console.log('账户已切换:', accounts);
                if (accounts.length === 0) {
                    // Metamask锁定了或用户断开了所有账户的连接
                    antdMessage.warning('Metamask 已锁定或账户已断开连接。');
                    // TODO: 在这里可以清除应用中与账户相关的状态，可选：
                    // setGlobalSignerAddress(null);
                    // navigate('/'); // 可能导航回首页
                    // 通常也可以刷新页面以重置状态
                    window.location.reload();
                } else {
                    // 账户切换
                    const newAddress = accounts[0];
                    antdMessage.info(`账户已切换到: ${newAddress.substring(0,6)}...${newAddress.substring(newAddress.length - 4)}`);
                    // 更新全局账户状态（如果需要）
                    // setGlobalSignerAddress(newAddress);
                    // 强制刷新页面以确保所有组件都使用新的账户信息重新初始化
                    // 最简单直接的处理方式，避免状态不一致
                    window.location.reload();
                }
            };

            ethereum.on('accountsChanged', handleAccountsChanged);

            // 组件卸载时移除监听器
            return () => {
                if (ethereum && ethereum.isMetaMask) { // 添加 ethereum 检查
                    ethereum.removeListener('chainChanged', handleChainChanged);
                    ethereum.removeListener('accountsChanged', handleAccountsChanged);
                }
            };
        }
    }, []); // 依赖数组保持为空

    const handleSwitchNetworkInModal = async () => {
        if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            // DEV-TOPO: 调用在 blockchain.ts 中定义的函数 (理想情况下应该从那里导出)
            // 这里为了演示，简化调用，实际应复用 blockchain.ts 中的逻辑
            try {
                await provider.send("wallet_switchEthereumChain", [{ chainId: APP_EXPECTED_CHAIN_ID }]);
                // 切换成功后 Metamask 可能会刷新页面
                // } catch (switchError: any) {
                //     if (switchError.code === 4902) {
                //         try {
                //             await provider.send("wallet_addEthereumChain", [
                //                 {
                //                     chainId: APP_EXPECTED_CHAIN_ID,
                //                     chainName: APP_EXPECTED_NETWORK_NAME,
                //                     rpcUrls: ["http://127.0.0.1:8545"],     // 与 blockchain.ts 一致
                //                     nativeCurrency: { name: APP_EXPECTED_NETWORK_NAME, symbol: "ETH", decimals: 18 },
                //                 },
                //             ]);
                //         } catch (addError) {
                //             antdMessage.error(`添加网络 ${APP_EXPECTED_NETWORK_NAME} 失败。`);
                //         }
                //     } else {
                //          antdMessage.error(`切换网络失败。`);
                //     }
                // }
            } catch (switchErr: unknown) { // 修改为 unknown
                 let code: number | undefined;
                 let message: string | undefined;

                 if (typeof switchErr === 'object' && switchErr !== null) {
                     const error = switchErr as { code?: number; message?: string };
                     code = error.code;
                     message = error.message;
                 }

                 if (code === 4902) {
                     try {
                         // ... addEthereumChain logic ...
                     } catch (addErr: unknown) {
                          console.error("添加网络失败:", addErr); // 只是为了防止 ESLint 报错
                          let specificAddErrorMessage: string | undefined;
                          if (typeof addErr === 'object' && addErr !== null && 'message' in addErr) {
                             specificAddErrorMessage = (addErr as {message: string}).message;
                          }
                          antdMessage.error(`添加网络 ${APP_EXPECTED_NETWORK_NAME} 失败。${specificAddErrorMessage ? `原因: ${specificAddErrorMessage}` : ''}`);
                      }
                 } else {
                     antdMessage.error(message || `切换网络失败。`);
                 }
             }
        }
    };
    return (
        // ConfigProvider 用于配置 Ant Design 的全局特性，如中文语言包
        <ConfigProvider
            // 需要中文语言包 (antd 默认是英文，但多数组件内文本是中文或无文本)，这样做为了提高兼容性
            locale={zhCN} // 设置中文语言包
            theme={{
                // token: { colorPrimary: '#00b96b' }, // 如：自定义主题色的Mode
            }}
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
            {/* 错误网络提示模态框 */}
            <Modal
                title="网络错误"
                open={isWrongNetwork}
                // onOk={handleSwitchNetworkInModal} // 用户点击确定尝试切换
                // onCancel={() => setIsWrongNetwork(false)} // TODO: 用户可以关闭模态框，但应用可能仍不可用
                closable={false} // 不允许直接关闭，除非切换网络
                maskClosable={false} // 不允许点击遮罩层关闭
                footer={[
                    <AntdButton key="switch" type="primary" onClick={handleSwitchNetworkInModal}>
                        切换到 {APP_EXPECTED_NETWORK_NAME}
                    </AntdButton>,
                ]}
            >
                <p>您当前连接的网络 (Chain ID: {currentChainId || '未知'}) 与本应用期望的网络 ({APP_EXPECTED_NETWORK_NAME} - Chain ID: {APP_EXPECTED_CHAIN_ID}) 不符。</p>
                <p>请切换到正确的网络以继续使用本应用。</p>
            </Modal>
        </ConfigProvider>
    );
};

export default App;     // 使用默认导出
