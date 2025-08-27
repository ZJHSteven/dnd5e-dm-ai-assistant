// 聊天界面组件 - 显示对话历史和发送消息

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Select,
  Badge,
  Spinner,
  Stack,
  Portal,
  createListCollection
} from '@chakra-ui/react';
import { ChatRequest, ChatResponse, ConversationRecord } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatInterfaceProps {
  onSendMessage: (request: ChatRequest) => Promise<ChatResponse>;
  isLoading?: boolean;
  tokenCount?: number;
  onRequestSendMessage?: (handler: (blocks: any) => Promise<void>) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  isLoading = false,
  tokenCount = 0,
  onRequestSendMessage
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-3.5-turbo');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 可选的模型列表
  const availableModels = useMemo(() => createListCollection({
    items: [
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
      { value: 'claude-3-opus', label: 'Claude 3 Opus' }
    ]
  }), []);

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理发送消息（这个函数会被父组件调用）
  const handleSendMessage = async (blocks: any) => {
    // 创建用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: generateUserPrompt(blocks),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // 调用API发送消息
      const response = await onSendMessage({
        blocks,
        model: selectedModel
      });

      // 创建AI回复消息
      const assistantMessage: Message = {
        id: response.timestamp.toString(),
        role: 'assistant',
        content: response.content,
        timestamp: response.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('发送消息失败:', error);
      
      // 显示错误消息
      const errorMessage: Message = {
        id: Date.now().toString() + '_error',
        role: 'assistant',
        content: '抱歉，发送消息时出现错误。请稍后重试。',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // 生成用户提示词预览（简化版）
  const generateUserPrompt = (blocks: any): string => {
    const parts: string[] = [];
    
    if (blocks.current_prompt) {
      parts.push(`**当前问题：** ${blocks.current_prompt}`);
    }
    
    if (blocks.game_log) {
      parts.push(`**游戏实录：** ${blocks.game_log.slice(0, 100)}...`);
    }
    
    if (blocks.dm_private) {
      parts.push(`**DM私记：** [机密内容]`);
    }
    
    return parts.join('\n\n');
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 将发送消息方法暴露给父组件
  useEffect(() => {
    if (onRequestSendMessage) {
      onRequestSendMessage(handleSendMessage);
    }
  }, [handleSendMessage, onRequestSendMessage]);

  return (
    <VStack h="full" gap={0}>
      {/* 顶部工具栏 */}
      <HStack
        w="full"
        p={3}
        bg="bg.muted"
        borderBottomWidth="1px"
        borderColor="border"
        justify="space-between"
        flexShrink={0}
      >
        <HStack>
          {/* 模型选择器 */}
          <Select.Root
            collection={availableModels}
            value={[selectedModel]}
            onValueChange={(details) => setSelectedModel(details.value[0] || 'gpt-3.5-turbo')}
            size="sm"
            width="180px"
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="选择模型" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {availableModels.items.map(model => (
                    <Select.Item key={model.value} item={model}>
                      {model.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

          {/* Token估算 */}
          <Badge variant="surface" size="sm">
            ~{Math.ceil(tokenCount / 1000 * 10) / 10}k tokens
          </Badge>
        </HStack>

        {/* 加载状态 */}
        {isLoading && (
          <HStack>
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              AI正在思考中...
            </Text>
          </HStack>
        )}
      </HStack>

      {/* 消息列表区域 */}
      <Box
        flex={1}
        w="full"
        overflowY="auto"
        bg="bg"
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
        <Stack p={4} gap={4}>
          {/* 欢迎消息 */}
          {messages.length === 0 && (
            <Box
              textAlign="center"
              color="fg.muted"
              py={10}
            >
              <Text fontSize="lg" mb={2}>
                🎲 D&D 5e DM AI 助手
              </Text>
              <Text fontSize="sm">
                在下方编辑区填写相关信息，然后点击发送开始对话
              </Text>
            </Box>
          )}

          {/* 渲染消息列表 */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              timestamp={formatTimestamp(message.timestamp)}
            />
          ))}

          {/* 加载指示器 */}
          {isLoading && (
            <HStack justify="flex-start" py={2}>
              <Box
                bg="gray.100"
                rounded="xl"
                p={3}
                maxW="xs"
              >
                <HStack>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="fg.muted">
                    AI正在回复...
                  </Text>
                </HStack>
              </Box>
            </HStack>
          )}
        </Stack>
        
        {/* 自动滚动锚点 */}
        <div ref={messagesEndRef} />
      </Box>
    </VStack>
  );
};

// 消息气泡组件
interface MessageBubbleProps {
  message: Message;
  timestamp: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, timestamp }) => {
  const isUser = message.role === 'user';

  return (
    <HStack
      align="flex-start"
      justify={isUser ? 'flex-end' : 'flex-start'}
      w="full"
    >
      {/* AI头像 */}
      {!isUser && (
        <Box
          w={8}
          h={8}
          bg="blue.500"
          rounded="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="sm"
          color="white"
          flexShrink={0}
        >
          🤖
        </Box>
      )}

      {/* 消息内容 */}
      <VStack
        align={isUser ? 'flex-end' : 'flex-start'}
        gap={1}
        maxW="75%"
      >
        {/* 角色标识 */}
        <HStack>
          <Text fontSize="xs" color="fg.muted" fontWeight="medium">
            {isUser ? '你' : 'AI'}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {timestamp}
          </Text>
        </HStack>

        {/* 消息气泡 */}
        <Box
          bg={isUser ? 'blue.500' : 'gray.100'}
          color={isUser ? 'white' : 'fg'}
          rounded="xl"
          p={3}
          position="relative"
          maxW="full"
          wordBreak="break-word"
          whiteSpace="pre-wrap"
        >
          <Text fontSize="sm" lineHeight="relaxed">
            {message.content}
          </Text>
        </Box>
      </VStack>

      {/* 用户头像 */}
      {isUser && (
        <Box
          w={8}
          h={8}
          bg="green.500"
          rounded="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="sm"
          color="white"
          flexShrink={0}
        >
          👤
        </Box>
      )}
    </HStack>
  );
};