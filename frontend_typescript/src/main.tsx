// food_traceability_platform/frontend_typescript/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import App from './App.tsx';
import HomePage from './pages/HomePage.tsx';
import AddFoodPage from './pages/AddFoodPage.tsx';
import FoodDetailPage from './pages/FoodDetailPage.tsx';
import SearchPage from './pages/SearchPage.tsx'; // 引入 SearchPage
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <nav style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <Link to="/" style={{ marginRight: '15px' }}>首页</Link>
        <Link to="/add-food" style={{ marginRight: '15px' }}>录入食品</Link>
        <Link to="/search">搜索食品</Link>
      </nav>
      <Routes>
        <Route path="/" element={<App />}> {/* App 可以作为布局组件 */}
          <Route index element={<HomePage />} />
          <Route path="add-food" element={<AddFoodPage />} />
          <Route path="search" element={<SearchPage />} /> {/* 添加搜索页面路由 */}
          <Route path="food/:productId" element={<FoodDetailPage />} />
          {/* 可以在这里添加一个404页面 */}
          <Route path="*" element={<div><h2>404 - 页面未找到</h2><Link to="/">返回首页</Link></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
