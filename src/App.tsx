// D&D 5e DM AI 助手主应用组件
// 实现垂直布局：聊天区域 + 分块编辑区 + Token预览

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text
} from '@chakra-ui/react';

import { ChatInterface } from './components/ChatInterface';
import { BlockInput } from './components/BlockInput';
import { localCache } from './localCache';
import { ChatRequest, ChatResponse, UserInputBlocks } from './types';

// Token 估算函数（粗略计算）
const estimateTokens = (blocks: UserInputBlocks): number => {
  const text = Object.values(blocks).join(' ');
  // 粗略估算：4个字符约等于1个token
  return Math.ceil(text.length / 4);
};

export const App: React.FC = () => {
  const [blocks, setBlocks] = useState<UserInputBlocks>({
    current_prompt: '',
    game_log: '',
    module_snippet: '',
    dm_private: '',
    char_status: {},
    system_prompt: '',
    character_cards: {},
    items: {},
    other: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [sendMessageHandler, setSendMessageHandler] = useState<((blocks: any) => Promise<void>) | null>(null);

  // 计算Token数
  const tokenCount = estimateTokens(blocks);

  // 从本地缓存加载数据
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cachedBlocks = await localCache.loadBlocks();
        setBlocks(cachedBlocks);
      } catch (error) {
        console.error('加载本地缓存失败:', error);
      }
    };

    loadCachedData();
  }, []);

  // 自动保存到本地缓存（防抖）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localCache.saveBlocks(blocks).catch(error => {
        console.error('保存本地缓存失败:', error);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [blocks]);

  // 处理分块数据变化
  const handleBlocksChange = useCallback((newBlocks: UserInputBlocks) => {
    setBlocks(newBlocks);
  }, []);

  // 发送消息到后端API
  const handleSendMessage = async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || '发送消息失败');
      }

      const data = await response.json() as ChatResponse;
      return data;
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  };

  // 处理发送按钮点击
  const handleSendClick = async () => {
    // 验证当前问题不为空
    if (!blocks.current_prompt.trim()) {
      alert('请输入当前问题');
      return;
    }

    setIsLoading(true);

    try {
      if (sendMessageHandler) {
        await sendMessageHandler(blocks);
        console.log('消息发送成功');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box h="100vh" bg="bg" overflow="hidden">
      <VStack h="full" gap={0}>
        {/* 顶部操作栏 */}
        <HStack
          w="full"
          p={4}
          bg="bg.muted"
          borderBottomWidth="1px"
          borderColor="border"
          justify="space-between"
          flexShrink={0}
        >
          <HStack>
            <Text fontSize="xl" fontWeight="bold" color="fg">
              🎲 D&D 5e DM AI 助手
            </Text>
          </HStack>
          
          <HStack>
            <Button 
              onClick={handleSendClick}
              colorPalette="blue"
              variant="solid"
              size="md"
              loading={isLoading}
              disabled={!blocks.current_prompt.trim()}
            >
              发送消息
            </Button>
          </HStack>
        </HStack>

        {/* 主内容区域 */}
        <HStack h="full" w="full" gap={0} align="stretch">
          {/* 左侧：聊天区域 */}
          <Box flex={1} h="full">
            <ChatInterface
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              tokenCount={tokenCount}
              onRequestSendMessage={(handler) => setSendMessageHandler(() => handler)}
            />
          </Box>

          {/* 右侧：分块编辑区 */}
          <Box 
            w="50%" 
            h="full" 
            borderLeftWidth="1px" 
            borderColor="border"
            bg="bg"
            overflowY="auto"
            css={{
              '&::-webkit-scrollbar': {
                width: '6px'
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--chakra-colors-border)',
                borderRadius: '3px'
              }
            }}
          >
            <Box p={4}>
              <BlockInput
                value={blocks}
                onChange={handleBlocksChange}
              />
            </Box>
          </Box>
        </HStack>

        {/* 底部状态栏 */}
        <HStack
          w="full"
          px={4}
          py={2}
          bg="bg.muted"
          borderTopWidth="1px"
          borderColor="border"
          justify="space-between"
          flexShrink={0}
        >
          <Text fontSize="sm" color="fg.muted">
            半屏友好设计 | 自动保存至本地缓存
          </Text>
          
          <Text fontSize="sm" color="fg.muted">
            📊 预估 Token: ~{Math.ceil(tokenCount / 1000 * 10) / 10}k
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
};