// food_traceability_platform/frontend_typescript/src/pages/HomePage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div>
      <h2>欢迎来到食品溯源系统</h2>
      <nav>
        <ul>
          <li>
            <Link to="/add-food">录入新食品</Link>
          </li>
          <li>
            <Link to="/search">搜索食品信息</Link>
          </li>
        </ul>
      </nav>
      {/* 后续这里可以展示食品列表 */}
    </div>
  );
};

export default HomePage;
