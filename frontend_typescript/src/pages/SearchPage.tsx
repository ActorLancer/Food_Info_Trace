// food_traceability_platform/frontend_typescript/src/pages/SearchPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchTerm.trim()) {
      // 假设我们通过 product ID 搜索，并直接跳转到详情页
      // 实际应用中可能是跳转到一个结果列表页或直接获取数据
      navigate(`/food/${searchTerm.trim()}`);
    }
  };

  return (
    <div>
      <h2>搜索食品溯源信息</h2>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="输入产品ID进行搜索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginRight: '10px' }}
        />
        <button type="submit">搜索</button>
      </form>
    </div>
  );
};

export default SearchPage;
