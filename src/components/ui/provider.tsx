// Chakra UI v3 Provider 组件
import { ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react'
import React from 'react'

// 创建自定义主题系统
const system = createSystem(defaultConfig, {
  // 可以在这里自定义主题配置
  theme: {
    tokens: {
      // 自定义颜色token
    }
  }
})

interface ProviderProps {
  children: React.ReactNode
}

export const Provider: React.FC<ProviderProps> = ({ children }) => {
  return (
    <ChakraProvider value={system}>
      {children}
    </ChakraProvider>
  )
}