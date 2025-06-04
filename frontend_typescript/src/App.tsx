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
import { Outlet } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <div className="app-container">
      {/* <h1>食品溯源系统 - 主应用框架</h1> */} {/* 可以保留或移除，取决于你的设计 */}
      <main className="content">
        <Outlet /> {/* 子路由对应的组件会在这里渲染 */}
      </main>
      <footer style={{ textAlign: 'center', marginTop: '20px', padding: '10px', borderTop: '1px solid #eee' }}>
        © 2024 食品溯源平台
      </footer>
    </div>
  );
}

export default App;
