import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom'; // 重命名 Link 为 RouterLink 以避免与 AntD Link 冲突

import App from './App.tsx';    // import { App } from './App.tsx';
import HomePage from './pages/HomePage.tsx';
import AddFoodPage from './pages/AddFoodPage.tsx';
import FoodDetailPage from './pages/FoodDetailPage.tsx';
import SearchPage from './pages/SearchPage.tsx';
import 'antd/dist/reset.css';   // Sugest: 在自定义样式前, Ant Design v5+ 使用 reset.css 来替代 normalize.css
                                // Ant Design v4 or older，import 'antd/dist/antd.css';
import './index.css'; // 全局样式



ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* TODO */}
      {/* 导航栏可以后续用 AntD 的 Menu 组件重构到 App.tsx 中 */}
      {/* <nav style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <RouterLink to="/" style={{ marginRight: '15px' }}>首页</RouterLink>
        <RouterLink to="/add-food" style={{ marginRight: '15px' }}>录入食品</RouterLink>
        <RouterLink to="/search">搜索食品</RouterLink>
      </nav> */}
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="add-food" element={<AddFoodPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="food/:productId" element={<FoodDetailPage />} />
          <Route path="*" element={
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
              <h2>404 - 页面未找到</h2>
              <RouterLink to="/">返回首页</RouterLink>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
