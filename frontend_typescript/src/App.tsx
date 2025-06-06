// export default App
// import i18next from 'i18next';
// import { initReactI18next } from 'react-i18next';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers, type Eip1193Provider, type Signer } from 'ethers';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

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

    // --- 钱包相关状态 ---
    const [currentSigner, setCurrentSigner] = useState<Signer | null>(null);
    const [currentAddress, setCurrentAddress] = useState<string | null>(null);
    const [isNetworkCorrect, setIsNetworkCorrect] = useState<boolean>(true); // 初始假设网络正确或未连接
    const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);

    const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
    const [currentChainId, setCurrentChainId] = useState<string | null>(null);

    const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

    // Ref 来确保某些初始化逻辑只执行一次，或者跟踪非 state 的持久值
    // const initialLoadDone = useRef(false);
    const initialLoadAttempted = useRef(false); // 用于标记是否已尝试过首次加载时的自动连接

    // Ant Design v5 的主题 token
    const {
        token: { colorBgContainer, borderRadiusLG, colorPrimary },
    } = antdTheme.useToken();

    // const handleMenuClick = (e: { key: string }) => {
    //     navigate(e.key);
    // };
    const handleMenuClick = useCallback((e: { key: string }) => {
        navigate(e.key);
    }, [navigate]);

    // 自定义的 antd 提示函数（把 showAppMessage 包在 useCallback 中）
    const showAppMessage = useCallback((msg: string, type: 'error' | 'warning' | 'info' | 'success') => {
        switch (type) {
            case 'error': antdMessage.error(msg); break;
            case 'warning': antdMessage.warning(msg); break;
            case 'info': antdMessage.info(msg); break;
            case 'success': antdMessage.success(msg); break;
            default: antdMessage.info(msg);
        }
    }, []);

    // const showAppMessage = (msg: string, type: 'error' | 'warning' | 'info' | 'success') => {
    //     switch (type) {
    //         case 'error': antdMessage.error(msg); break;
    //         case 'warning': antdMessage.warning(msg); break;
    //         case 'info': antdMessage.info(msg); break;
    //         case 'success': antdMessage.success(msg); break;
    //         default: antdMessage.info(msg);
    //     }
    // };

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
    // const getCurrentSelectedKey = () => {
    //   const patterns = [
    //     { path: '/food/*', key: '/' },
    //     { path: '/add-food/*', key: '/add-food' },
    //     { path: '/search/*', key: '/search' },
    //   ];
    //   for (const { path, key } of patterns) {
    //     if (matchPath(path, location.pathname)) {
    //       return [key];
    //     }
    //   }
    //   return ['/'];
    // };

    const getCurrentSelectedKey = useCallback(() => {
        if (location.pathname.startsWith('/food/')) {
            return ['/'];
        }
        const currentPathItem = menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(item.key + '/'));
        return currentPathItem ? [currentPathItem.key] : ['/'];
    }, [location.pathname]); // location.pathname 是稳定的，除非路由变化
    // const getCurrentSelectedKey = useCallback(() => {
    //     const patterns = [
    //       { path: '/food/*', key: '/' },
    //       { path: '/add-food/*', key: '/add-food' },
    //       { path: '/search/*', key: '/search' },
    //     ];
    //     for (const { path, key } of patterns) {
    //       if (matchPath(path, location.pathname)) {
    //         return [key];
    //       }
    //     }
    //     return location.pathname.startsWith('/food/') ? ['/'] : [menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(item.key + '/'))?.key || '/'];
    // }, [location.pathname]);

    // TODO: 添加一个全局的 signerAddress state，如果很多组件都需要它
    // 或者让每个需要 signerAddress 的组件自己通过 connectWallet 获取
    // --- 连接钱包的函数 ---
    const connectWallet = useCallback(async (isTriggeredBySystem = false) => { // isTriggeredBySystem: true 表示由事件或自动逻辑触发
        console.log(`connectWallet called. isTriggeredBySystem: ${isTriggeredBySystem}, isConnectingWallet: ${isConnectingWallet}`);
        if (isConnectingWallet && !isTriggeredBySystem) { // 如果是用户点击且已在连接中，则阻止
            console.log("connectWallet: User click while already connecting, exiting.");
            return;
        }
        // 对于系统触发的，允许它继续，因为它可能是对状态变化的响应

        setIsConnectingWallet(true);
        // setIsNetworkCorrect(true); // 重置网络状态
        const connectionDetails = await getProviderAndSigner(showAppMessage);

        if (connectionDetails) {
            console.log("connectWallet: Connection successful.", connectionDetails);
            setCurrentSigner(connectionDetails.signer);
            setCurrentAddress(connectionDetails.signerAddress.toLowerCase()); // 统一存储为小写
            setIsNetworkCorrect(connectionDetails.isExpectedNetwork);
            sessionStorage.removeItem('userDisconnectedManually');
            if (connectionDetails.isExpectedNetwork && !isTriggeredBySystem) {
                antdMessage.success(`钱包已连接: ${connectionDetails.signerAddress.substring(0, 6)}...`);
            }
        } else {
            console.log("connectWallet: Connection failed or cancelled by user.");
            // 只有当不是系统自动触发的连接失败时，才主动清空状态
            // 系统自动触发的连接失败（如 accountsChanged 返回空）通常意味着外部状态已变，应信任该状态
            if (!isTriggeredBySystem) {
                setCurrentSigner(null);
                setCurrentAddress(null);
                setIsNetworkCorrect(true);
            }
        }
        setIsConnectingWallet(false);
    }, [isConnectingWallet, showAppMessage]);   // showAppMessage 是 useCallback 的行

    const disconnectWallet = useCallback(() => {
        console.log("disconnectWallet called.");
        setCurrentSigner(null);
        setCurrentAddress(null);
        setIsNetworkCorrect(true);
        antdMessage.info('钱包已断开连接');
        // 注意：这只是清除了前端的状态，并没有真正从 Metamask 断开 DApp 的授权
        // 清除一个 localStorage 标志，表示用户已手动断开
        localStorage.setItem('userDisconnectedManually', 'true');
        // No need to touch 'autoConnectAttemptedThisSession' here,
        // that should be managed by the auto-connect logic itself per session.
    }, []); // No dependencies needed if it only sets state and uses sessionStorage
    // --------------------------------------------------------

    // --- 监听账户和网络变化 ---
    useEffect(() => {
        console.log("App useEffect triggered. currentAddress:", currentAddress, "isConnectingWallet:", isConnectingWallet, "initialLoadAttempted:", initialLoadAttempted.current);

        if (!window.ethereum) {
            console.warn("Metamask 未安装");
            return;
        }

        const handleAccountsChanged = (accounts: string[]) => {
            console.log('Metamask 账户已更改:', accounts, "Current known address:", currentAddress);
            // 清除手动断开的标志，因为账户变化是用户在 Metamask 中的主动行为
            const newAddress = accounts.length > 0 ? accounts[0].toLowerCase() : null;

            if (newAddress === null) {
                antdMessage.warning('钱包账户已断开，请重新连接。');
                disconnectWallet();
            } else if (newAddress !== currentAddress) { // 账户已切换
                antdMessage.info('检测到钱包账户切换，正在重新连接...');
                // sessionStorage.removeItem('userDisconnectedManually'); // 由 connectWallet 成功时处理
                connectWallet(true); // Treat as an auto-triggered event
            }
            // 如果 newAddress === currentAddress，则什么都不做 (账户没变)
        };

        const handleChainChanged = (chainId: string) => {
            console.log('Metamask 网络已更改:', chainId, "Current known address:", currentAddress);            setCurrentChainId(chainId);
            if (currentAddress) { // 只有当钱包已连接时才响应网络变化
                antdMessage.warning('检测到网络切换，正在重新验证网络状态...', 3);
                connectWallet(true); // 作为系统触发事件
            }
            // if (chainId !== APP_EXPECTED_CHAIN_ID) {
            //     setIsWrongNetwork(true);
            //     antdMessage.error(`请切换到 ${APP_EXPECTED_NETWORK_NAME} (Chain ID: ${APP_EXPECTED_CHAIN_ID})`);
            // } else {
            //     setIsWrongNetwork(false);
            //     antdMessage.success('网络已切换至正确网络。');
            //     connectWallet(); // 确保切换到正确网络后更新状态
            // }

            // antdMessage.warning('检测到网络切换，正在重新验证网络状态...', 3);
            // // Metamask 建议重载页面，但我们尝试重新连接获取新状态
            // // window.location.reload();
            // connectWallet(); // 重新连接会更新地址和网络状态
        };

        // --- 初始加载时的自动连接逻辑 ---
        if (!initialLoadAttempted.current) {
            const userDisconnectedManually = sessionStorage.getItem('userDisconnectedManually') === 'true';
            const selectedAddressFromMetamask = window.ethereum.selectedAddress ? window.ethereum.selectedAddress.toLowerCase() : null;

            console.log("useEffect: Initial load check. selectedAddressFromMetamask:", selectedAddressFromMetamask, "currentAddress (state):", currentAddress, "isConnectingWallet:", isConnectingWallet, "userDisconnectedManually:", userDisconnectedManually);

            if (selectedAddressFromMetamask && !currentAddress && !isConnectingWallet && !userDisconnectedManually) {
                console.log("useEffect: Attempting initial auto-connect.");
                connectWallet(true); // 作为系统触发事件
            }
            initialLoadAttempted.current = true; // 标记首次加载逻辑已执行，无论是否连接成功
        }
        // --- 结束初始加载逻辑 ---

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
            console.log("App useEffect cleanup: Removing listeners for accountsChanged and chainChanged.");
            if (window.ethereum?.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
        // 依赖项保持不变，因为 connectWallet 和 disconnectWallet 已经是 useCallback 的
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAddress, connectWallet, disconnectWallet, isConnectingWallet]); // 当 currentAddress 或 connectWallet 变化时，确保监听器正确设置/移除

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
                        selectedKeys={getCurrentSelectedKey()} // 已 useCallback
                        onClick={handleMenuClick} // 已 useCallback
                        items={menuItems}
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
                                            {/* 修改按钮文本和行为：点击后不应期望它直接切换网络，而是提示用户手动切换，并可以重新触发检查 */}
                                            <Button type="text" danger icon={<WarningOutlined />} onClick={() => connectWallet()}>检查网络</Button>
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
                                    onClick={() => connectWallet()} // 明确非自动触发
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
                            {window.ethereum && !isNetworkCorrect && currentAddress && (
                                <Alert
                                    message="网络连接错误"
                                    description={`请将您的 Metamask 切换到 ${APP_EXPECTED_NETWORK_NAME} (Chain ID: ${APP_EXPECTED_CHAIN_ID}) 网络。部分功能可能无法正常使用。`}
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />
                            )}
                            {/* 确保 WalletContextType 定义在某处，并且 Outlet context 传递正确 */}
                            <Outlet context={{ currentAddress, currentSigner, isNetworkCorrect, connectWallet } satisfies WalletContextType} />                       </div>
                    </Content>
                    <Footer style={{ textAlign: 'center' }}>
                        食品溯源平台 ©{new Date().getFullYear()} CBy Luna
                    </Footer>
                </Layout>
            </Layout>
            {/* 错误网络提示模态框 */}
            {/* 允许用户关闭模态框，并通过页面上的 Alert 继续提醒网络错误。 */}
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
