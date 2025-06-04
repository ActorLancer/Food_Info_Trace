// food_traceability_platform/frontend_typescript/src/pages/FoodDetailPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

const FoodDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();

  return (
    <div>
      <h2>食品溯源详情</h2>
      <p>产品 ID: {productId}</p>
      {/* 食品的详细溯源信息将在这里展示 */}
    </div>
  );
};

export default FoodDetailPage;
