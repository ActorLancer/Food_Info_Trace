// export default App
// import i18next from 'i18next';
// import { initReactI18next } from 'react-i18next';
import React, { useState, useEffect, useCallback } from 'react';
import { ethers, type Eip1193Provider, type Signer } from 'ethers';
import { Outlet, useLocation, useNavigate, matchPath, Navigate } from 'react-router-dom';

import zhCN from 'antd/locale/zh_CN'; // 导入中文语言包
import dayjs from 'dayjs'; // AntD 日期组件依赖 dayjs
import 'dayjs/locale/zh-cn'; // 导入 dayjs 的中文语言配置
dayjs.locale('zh-cn'); // 全局设置 dayjs 的语言为中文

import {
  Layout,
  Menu,
  Typography,
  theme as antdTheme,
  ConfigProvider,
  Modal,
  Button,
  message as antdMessage,
  Space,
  Tag,
  Tooltip,
  Alert
} from 'antd'; // 引入 ConfigProvider

// import { HomeOutlined, FormOutlined, SearchOutlined, BarChartOutlined } from '@ant-design/icons'; // 引入图标
import {
  HomeOutlined,
  FormOutlined,
  SearchOutlined,
  WalletOutlined,
  LogoutOutlined,
  WarningOutlined,
} from '@ant-design/icons'; // 引入图标

// (EXPECTED_CHAIN_ID 等常量从 utils/blockchain.ts 导入或在这里重新定义)
// 最好是从 utils/blockchain.ts 导出并在这里导入，以保持一致性
import {
    getProviderAndSigner,
    EXPECTED_CHAIN_ID as APP_EXPECTED_CHAIN_ID,
    EXPECTED_NETWORK_NAME as APP_EXPECTED_NETWORK_NAME,
    EXPECTED_RPC_URL,
    NATIVE_CURRENCY,
} from './utils/blockchain';

// 如果这里选择硬编码，但实际项目中应共享
// const APP_EXPECTED_CHAIN_ID = "0x539"; // 与 utils/blockchain.ts 中的一致
// const APP_EXPECTED_NETWORK_NAME = "Hardhat Local";

// 声明 window.ethereum 的类型
// declare global {
//     interface Window {
//         ethereum?: Eip1193Provider & { // 使用 Eip1193Provider 并添加 Metamask 特有的属性
//             isMetaMask?: boolean;
//             selectedAddress?: string | null;
//             on: (event: string, handler: (...args: any[]) => void) => void; // 添加 on 方法签名
//             removeListener: (event: string, handler: (...args: any[]) => void) => void; // 添加 removeListener 方法签名
//         };
//     }
// }

// 为 window.ethereum 的类型定义添加更严格的约束，例如使用 Eip1193Provider 的完整接口
interface EthereumProvider extends Eip1193Provider {
    isMetaMask?: boolean;
    selectedAddress?: string | null;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
}

declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}



const { Header, Content, Footer, Sider } = Layout;
const { Title, Text } = Typography;

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

    // --- 钱包相关状态 ---
    const [currentSigner, setCurrentSigner] = useState<Signer | null>(null);
    const [currentAddress, setCurrentAddress] = useState<string | null>(null);
    const [isNetworkCorrect, setIsNetworkCorrect] = useState<boolean>(true); // 初始假设网络正确或未连接
    const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);

    const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
    const [currentChainId, setCurrentChainId] = useState<string | null>(null);

    const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

    // Ant Design v5 的主题 token
    const {
        token: { colorBgContainer, borderRadiusLG, colorPrimary },
    } = antdTheme.useToken();

    const handleMenuClick = (e: { key: string }) => {
        navigate(e.key);
    };

    // 自定义的 antd 提示函数
    const showAppMessage = (msg: string, type: 'error' | 'warning' | 'info' | 'success') => {
        switch (type) {
            case 'error': antdMessage.error(msg); break;
            case 'warning': antdMessage.warning(msg); break;
            case 'info': antdMessage.info(msg); break;
            case 'success': antdMessage.success(msg); break;
            default: antdMessage.info(msg);
        }
    };

    // 获取当前选中的菜单项的 key
    // 确保即使是子路由也能正确高亮父菜单
    // const getCurrentSelectedKey = () => {
    //     // 对于 /food/:productId 这样的详情页，希望仍然高亮 '/' (首页/列表页)
    //     if (location.pathname.startsWith('/food/')) {
    //         return ['/'];
    //     }
    //     const currentPath = menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(item.key + '/'));
    //     return currentPath ? [currentPath.key] : ['/']; // 默认高亮首页
    // };
    // 根据当前路由匹配来高亮侧边栏（或顶部菜单）的菜单项
    const getCurrentSelectedKey = () => {
      const patterns = [
        { path: '/food/*', key: '/' },
        { path: '/add-food/*', key: '/add-food' },
        { path: '/search/*', key: '/search' },
      ];
      for (const { path, key } of patterns) {
        if (matchPath(path, location.pathname)) {
          return [key];
        }
      }
      return ['/'];
    };

    // TODO: 添加一个全局的 signerAddress state，如果很多组件都需要它
    // 或者让每个需要 signerAddress 的组件自己通过 connectWallet 获取
    // --- 连接钱包的函数 ---
    const connectWallet = useCallback(async (isAutoConnect = false) => { // 添加一个参数区分是否是自动连接
        if (isConnectingWallet && !isAutoConnect) return; // 如果正在连接（非自动），则避免重复触发

        setIsConnectingWallet(true);
        setIsNetworkCorrect(true); // 重置网络状态
        const connectionDetails = await getProviderAndSigner(showAppMessage);
        if (connectionDetails) {
            setCurrentSigner(connectionDetails.signer);
            setCurrentAddress(connectionDetails.signerAddress);
            setIsNetworkCorrect(connectionDetails.isExpectedNetwork);
            if (connectionDetails.isExpectedNetwork && !isAutoConnect) {
                antdMessage.success(`钱包已连接: ${connectionDetails.signerAddress.substring(0,6)}...`);
            }
            // 网络错误的提示已在 getProviderAndSigner 中处理
        } else {
            // 如果是自动连接失败，不需要显式清除状态，因为可能本来就是 null
            if (!isAutoConnect) {
                setCurrentSigner(null);
                setCurrentAddress(null);
            }
        }
        setIsConnectingWallet(false);
    }, [isConnectingWallet, showAppMessage]); // 移除 currentAddress，因为 connectWallet 自身不应依赖它来决定是否执行

    const disconnectWallet = () => {
        setCurrentSigner(null);
        setCurrentAddress(null);    // 这会触发 useEffect
        setIsNetworkCorrect(true);  // 重置网络状态
        antdMessage.info('钱包已断开连接');
        // 注意：这只是清除了前端的状态，并没有真正从 Metamask 断开 DApp 的授权
        // 清除一个 localStorage 标志，表示用户已手动断开
        localStorage.setItem('userDisconnectedManually', 'true');
    };
    // --------------------------------------------------------

    // --- 监听账户和网络变化 ---
    useEffect(() => {
        if (!window.ethereum) {
            antdMessage.warning('请安装 Metamask 插件以使用全部功能。', 5);
            return;
        }

        const handleAccountsChanged = (accounts: string[]) => {
            console.log('Metamask 账户已更改:', accounts);
            const userDisconnected = localStorage.getItem('userDisconnectedManually') === 'true';

            if (accounts.length === 0) {
                // Metamask is locked or the user has disconnected all accounts
                antdMessage.warning('钱包账户已断开，请重新连接。');
                // 即使用户之前手动断开，如果 Metamask 通知账户为空，也应该断开
                disconnectWallet(); // disconnectWallet 内部会设置手动断开标志，这里可以考虑是否重置，或让用户再次点击连接
            } else if (accounts[0] !== currentAddress) {
                // 账户已切换，清除手动断开标志，重新连接以获取新的 signer 和地址
                // （通常也意味着需要重新验证网络）
                localStorage.removeItem('userDisconnectedManually');
                antdMessage.info('检测到钱包账户切换，正在重新连接...');
                connectWallet(); // 重新连接会更新地址和网络状态
            } else if (userDisconnected && accounts[0] === currentAddress) {
                // 这个分支可能较少见：账户没变，但之前是手动断开的，现在事件又来了
                // 可以选择什么都不做，等待用户手动连接
                console.log("账户未变，但之前是手动断开状态，不自动重连。");
            }
        };

        const handleChainChanged = (chainId: string) => {
            console.log('Metamask 网络已更改:', chainId);
            setCurrentChainId(chainId);
            if (chainId !== APP_EXPECTED_CHAIN_ID) {
                setIsWrongNetwork(true);
                antdMessage.error(`请切换到 ${APP_EXPECTED_NETWORK_NAME} (Chain ID: ${APP_EXPECTED_CHAIN_ID})`);
            } else {
                setIsWrongNetwork(false);
                antdMessage.success('网络已切换至正确网络。');
                connectWallet(); // 确保切换到正确网络后更新状态
            }

            // antdMessage.warning('检测到网络切换，正在重新验证网络状态...', 3);
            // // Metamask 建议重载页面，但我们尝试重新连接获取新状态
            // // window.location.reload();
            // connectWallet(); // 重新连接会更新地址和网络状态
        };

        // --- 自动连接逻辑 ---
        const autoConnectAttempted = sessionStorage.getItem('autoConnectAttempted'); // 使用 sessionStorage 保证只在会话开始时尝试一次
        const userDisconnectedManually = localStorage.getItem('userDisconnectedManually') === 'true';

        if (window.ethereum.selectedAddress && !currentAddress && !isConnectingWallet && !autoConnectAttempted && !userDisconnectedManually) {
            console.log("尝试自动连接已授权钱包...");
            sessionStorage.setItem('autoConnectAttempted', 'true'); // 标记已尝试自动连接
            connectWallet(true); // 传入 true 表示是自动连接
        }
        // --- 结束自动连接逻辑 ---

        // 初始检查网络和账户
        const initialize = async () => {
            try {
                if (!window.ethereum) {
                    console.error("没有检测到 MetaMask 或兼容的以太坊钱包");
                    return;
                }

                const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
                setCurrentChainId(chainId);
                setIsWrongNetwork(chainId !== APP_EXPECTED_CHAIN_ID);

                if (window.ethereum.selectedAddress && !currentAddress) {
                    console.log('尝试自动连接已授权钱包...');
                    connectWallet();
                }
            } catch (err) {
                console.error('初始化网络检查失败:', err);
            }
        };

        initialize();

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // 清理监听器
        return () => {
            if (window.ethereum?.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAddress, connectWallet, isConnectingWallet]); // 当 currentAddress 或 connectWallet 变化时，确保监听器正确设置/移除
    // connectWallet 用了 useCallback，所以通常不会频繁变化


    // useEffect(() => {
    //     const { ethereum } = window;
    //     if (ethereum && ethereum.isMetaMask) {
    //         // 初始网络检查
    //         const checkNetwork = async () => {
    //             try {
    //                 const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
    //                 setCurrentChainId(chainId);
    //                 if (chainId !== APP_EXPECTED_CHAIN_ID) {
    //                     setIsWrongNetwork(true);
    //                     console.warn(`网络不匹配: 当前 ${chainId}, 期望 ${APP_EXPECTED_CHAIN_ID}`);
    //                 } else {
    //                     setIsWrongNetwork(false);
    //                 }
    //             } catch (err) {
    //                 console.error("检查网络失败:", err);
    //                 // 可能 Metamask 未连接或有问题
    //             }
    //         };
    //         checkNetwork();

    //         // 监听网络变化事件
    //         const handleChainChanged = (newChainId: string) => {
    //             console.log('网络已切换:', newChainId);
    //             setCurrentChainId(newChainId);
    //             if (newChainId !== APP_EXPECTED_CHAIN_ID) {
    //                 setIsWrongNetwork(true);
    //                 // 可以选择强制刷新页面，因为网络切换可能导致之前的状态失效
    //                 // window.location.reload();
    //                 // 或者只是显示提示
    //             } else {
    //                 setIsWrongNetwork(false);
    //                 // 如果之前是错误网络，现在切换回来了，可以考虑自动刷新或提示用户
    //                 // window.location.reload(); // 切换回正确网络后刷新以确保状态一致
    //             }
    //         };

    //         ethereum.on('chainChanged', handleChainChanged);

    //         // 监听账户变化事件
    //         const handleAccountsChanged = (accounts: string[]) => {
    //             console.log('账户已切换:', accounts);
    //             if (accounts.length === 0) {
    //                 // Metamask锁定了或用户断开了所有账户的连接
    //                 antdMessage.warning('Metamask 已锁定或账户已断开连接。');
    //                 // TODO: 在这里可以清除应用中与账户相关的状态，可选：
    //                 // setGlobalSignerAddress(null);
    //                 // navigate('/'); // 可能导航回首页
    //                 // 通常也可以刷新页面以重置状态
    //                 window.location.reload();
    //             } else {
    //                 // 账户切换
    //                 const newAddress = accounts[0];
    //                 antdMessage.info(`账户已切换到: ${newAddress.substring(0,6)}...${newAddress.substring(newAddress.length - 4)}`);
    //                 // 更新全局账户状态（如果需要）
    //                 // setGlobalSignerAddress(newAddress);
    //                 // 强制刷新页面以确保所有组件都使用新的账户信息重新初始化
    //                 // 最简单直接的处理方式，避免状态不一致
    //                 window.location.reload();
    //             }
    //         };

    //         ethereum.on('accountsChanged', handleAccountsChanged);

    //         // 组件卸载时移除监听器
    //         return () => {
    //             if (ethereum && ethereum.isMetaMask) { // 添加 ethereum 检查
    //                 ethereum.removeListener('chainChanged', handleChainChanged);
    //                 ethereum.removeListener('accountsChanged', handleAccountsChanged);
    //             }
    //         };
    //     }
    // }, []); // 依赖数组保持为空

    const handleSwitchNetworkInModal = async () => {
        if (window.ethereum) {
            // 为网络切换和初始化操作添加加载状态
            // 在 UI 中显示加载提示（如按钮禁用或加载动画）
            setIsSwitchingNetwork(true);
            const provider = new ethers.BrowserProvider(window.ethereum);
            // DEV-TOPO: 调用在 blockchain.ts 中定义的函数 (理想情况下应该从那里导出)
            // 这里为了演示，简化调用，实际应复用 blockchain.ts 中的逻辑
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: APP_EXPECTED_CHAIN_ID }],
                });
                antdMessage.success(`已切换到 ${APP_EXPECTED_NETWORK_NAME}`);
                setIsWrongNetwork(false);
                connectWallet(); // 切换成功后重新连接

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
            } catch (switchErr: unknown) {
                const error = switchErr as { code?: number; message?: string };
                // let code: number | undefined;
                // let message: string | undefined;
                // if (typeof switchErr === 'object' && switchErr !== null) {
                //     const error = switchErr as { code?: number; message?: string };
                //     code = error.code;
                //     message = error.message;
                // }

                if (error.code === 4902) {
                    try {
                    // ... addEthereumChain logic ...
                    await provider.send("wallet_addEthereumChain", [
                        {
                            chainId: APP_EXPECTED_CHAIN_ID,
                            chainName: APP_EXPECTED_NETWORK_NAME,
                            rpcUrls: [EXPECTED_RPC_URL],
                            nativeCurrency: NATIVE_CURRENCY,
                        },
                    ]);
                    antdMessage.success(`已添加并切换到 ${APP_EXPECTED_NETWORK_NAME}`);
                            setIsWrongNetwork(false);
                            connectWallet();
                    } catch (addErr: unknown) {
                        antdMessage.error(`添加网络 ${APP_EXPECTED_NETWORK_NAME} 失败：${(addErr as Error).message || '未知错误'}`);
                        // console.error("添加网络失败:", addErr); // 只是为了防止 ESLint 报错
                        // let specificAddErrorMessage: string | undefined;
                        // if (typeof addErr === 'object' && addErr !== null && 'message' in addErr) {
                        //     specificAddErrorMessage = (addErr as {message: string}).message;
                        // }
                        // antdMessage.error(`添加网络 ${APP_EXPECTED_NETWORK_NAME} 失败。${specificAddErrorMessage ? `原因: ${specificAddErrorMessage}` : ''}`);
                    }
                } else {
                    antdMessage.error(`切换网络失败：${error.message || '未知错误'}`);
                }
             } finally {
                 setIsSwitchingNetwork(false);
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
                        {/* --- 显示钱包连接状态和操作按钮 --- */}
                        <Space>
                            {currentAddress ? (
                                <>
                                    <Tag color={isNetworkCorrect ? "blue" : "red"}>
                                        {isNetworkCorrect ? `${currentAddress.substring(0, 6)}...${currentAddress.substring(currentAddress.length - 4)}` : "网络错误"}
                                    </Tag>
                                    {!isNetworkCorrect && (
                                        <Tooltip title={`请切换到 ${APP_EXPECTED_NETWORK_NAME} (ID: ${APP_EXPECTED_CHAIN_ID})`}>
                                            <Button type="text" danger icon={<WarningOutlined />} onClick={connectWallet}>切换网络</Button>
                                        </Tooltip>
                                    )}
                                    <Button icon={<LogoutOutlined />} onClick={disconnectWallet} type="default">
                                        断开钱包
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<WalletOutlined />}
                                    onClick={connectWallet}
                                    loading={isConnectingWallet}
                                >
                                    {isConnectingWallet ? '连接中...' : '连接钱包'}
                                </Button>
                            )}
                        </Space>
                        {/* --- 结束钱包连接状态 --- */}
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
                            {/* --- 向下传递钱包状态和网络状态 --- */}
                            {/* 更好的方式是使用 React Context */}
                            {!window.ethereum && (
                                <Alert message="提示" description="请安装 Metamask 浏览器插件以使用本系统的全部区块链功能。" type="warning" showIcon />
                            )}
                            {window.ethereum && !isNetworkCorrect && currentAddress && ( // 只有当已连接但网络错误时，在内容区也给个强提示
                                <Alert
                                    message="网络连接错误"
                                    description={`请将您的 Metamask 切换到 ${APP_EXPECTED_NETWORK_NAME} (Chain ID: ${APP_EXPECTED_CHAIN_ID}) 网络。部分功能可能无法正常使用。`}
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />
                            )}
                            <Outlet context={{ currentAddress, currentSigner, isNetworkCorrect, connectWallet }} />
                        </div>
                    </Content>
                    <Footer style={{ textAlign: 'center' }}>
                        食品溯源平台 ©{new Date().getFullYear()} CBy Luna
                    </Footer>
                </Layout>
            </Layout>
            {/* 错误网络提示模态框 */}
            // 允许用户关闭模态框，并通过页面上的 Alert 继续提醒网络错误。
            <Modal
                title="网络错误"
                open={isWrongNetwork}
                // onOk={handleSwitchNetworkInModal} // 用户点击确定尝试切换
                // onCancel={() => setIsWrongNetwork(false)} // TODO: 用户可以关闭模态框，但应用可能仍不可用
                closable={true} // 允许用户关闭模态框，但保留警告提示（如在页面顶部显示 Alert）
                maskClosable={true} // 允许点击遮罩层关闭
                onCancel={() => setIsWrongNetwork(false)}
                footer={[
                    <Button key="switch" type="primary" onClick={handleSwitchNetworkInModal} loading={isSwitchingNetwork}>
                      切换到 {APP_EXPECTED_NETWORK_NAME}
                    </Button>,

                    // 添加一个“我知道了”按钮，但不推荐，因为应用在错误网络下功能不正常
                    <Button key="cancel" onClick={() => setIsWrongNetwork(false)}>
                        稍后处理
                    </Button>,

                ]}
            >
                <p>您当前连接的网络 (Chain ID: {currentChainId || '未知'}) 与本应用期望的网络 ({APP_EXPECTED_NETWORK_NAME} - Chain ID: {APP_EXPECTED_CHAIN_ID}) 不符。</p>
                <p>请切换到正确的网络以继续使用本应用。</p>
            </Modal>
        </ConfigProvider>
    );
};

export default App;     // 使用默认导出

// 定义 Outlet context 类型
export interface WalletContextType {
    currentAddress: string | null;
    currentSigner: Signer | null;
    isNetworkCorrect: boolean;
    connectWallet: () => Promise<void>;
}
