// Vite + React 应用入口文件
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from './components/ui/provider'
import { App } from './App'

// 创建根元素渲染点
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>,
)