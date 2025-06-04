// food_traceability_platform/frontend_typescript/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom'; // 重命名 Link 为 RouterLink 以避免与 AntD Link 冲突

import App from './App.tsx';
import HomePage from './pages/HomePage.tsx';
import AddFoodPage from './pages/AddFoodPage.tsx';
import FoodDetailPage from './pages/FoodDetailPage.tsx';
import SearchPage from './pages/SearchPage.tsx';
import './index.css'; // 您自己的全局样式 (可以保留或修改)

import 'antd/dist/reset.css'; // Ant Design v5+ 使用 reset.css 来替代 normalize.css (确保在您的 index.css 之前或之后，通常建议在自定义样式前)
// 如果您使用的是 Ant Design v4 或更早版本，可能是 import 'antd/dist/antd.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
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
