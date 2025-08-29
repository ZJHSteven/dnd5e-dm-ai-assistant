// 聊天界面组件 - 显示对话历史和发送消息

import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
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
  createListCollection,
  Separator
} from '@chakra-ui/react';

// 简单的SVG图标组件
const ChevronDownIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
  </svg>
);
import { ChatRequest, ChatResponse, ConversationRecord } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // 用户消息额外字段：存储完整的分块数据用于显示抽屉
  userBlocks?: any;
}

interface ChatInterfaceProps {
  onSendMessage: (request: ChatRequest) => Promise<ChatResponse>;
  isLoading?: boolean;
  tokenCount?: number;
  onRequestSendMessage?: (handler: (blocks: any) => Promise<void>) => void;
  onRestoreBlock?: (blockName: string, blockValue: any) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  isLoading = false,
  tokenCount = 0,
  onRequestSendMessage,
  onRestoreBlock
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 可选的模型列表 - 更新为实际可用的模型
  const availableModels = useMemo(() => createListCollection({
    items: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest' },
      { value: 'o3-2025-04-16', label: 'O3 (2025-04-16)' }
    ]
  }), []);

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载历史记录的函数
  const loadHistoryMessages = async () => {
    try {
      setIsLoadingHistory(true);
      
      // 调用后端API获取最近10条历史记录
      const response = await fetch('/api/history?page=1&limit=10');
      
      if (!response.ok) {
        throw new Error('获取历史记录失败');
      }
      
      const historyData = await response.json() as {
        conversations: ConversationRecord[];
        total: number;
        page: number;
        limit: number;
      };
      
      // 将历史记录转换为消息格式
      const historyMessages: Message[] = [];
      
      // 按时间戳排序（从旧到新）
      const sortedConversations = [...historyData.conversations].sort(
        (a, b) => a.time_stamp - b.time_stamp
      );
      
      sortedConversations.forEach(record => {
        // 解析用户输入
        let userInput;
        try {
          userInput = typeof record.user_input === 'string' 
            ? JSON.parse(record.user_input) 
            : record.user_input;
        } catch (error) {
          console.warn('解析用户输入失败:', error);
          userInput = { current_prompt: '解析失败的历史记录' };
        }
        
        // 添加用户消息
        const userMessage: Message = {
          id: `${record.time_stamp}_user`,
          role: 'user',
          content: generateUserPrompt(userInput),
          timestamp: record.time_stamp,
          userBlocks: userInput  // 保存完整的分块数据
        };
        historyMessages.push(userMessage);
        
        // 添加AI回复（如果存在）
        if (record.ai_response) {
          const assistantMessage: Message = {
            id: `${record.time_stamp}_assistant`,
            role: 'assistant',
            content: record.ai_response,
            timestamp: record.time_stamp
          };
          historyMessages.push(assistantMessage);
        }
      });
      
      // 更新消息状态
      setMessages(historyMessages);
      
      console.log(`成功加载 ${historyMessages.length} 条历史消息`);
      
    } catch (error) {
      console.error('加载历史记录失败:', error);
      
      // 显示错误提示，但不阻止用户继续使用
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ 加载历史记录失败，但您仍可以开始新的对话。',
        timestamp: Date.now()
      };
      setMessages([errorMessage]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 组件挂载时加载历史记录
  useEffect(() => {
    loadHistoryMessages();
  }, []);

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
      timestamp: Date.now(),
      userBlocks: blocks  // 保存完整的分块数据
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

  // 生成用户提示词预览（只显示当前问题）
  const generateUserPrompt = (blocks: any): string => {
    // 只返回当前问题，其他内容在抽屉中显示
    return blocks.current_prompt || '（未填写当前问题）';
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
            onValueChange={(details) => setSelectedModel(details.value[0] || 'gemini-2.5-flash')}
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
          {/* 历史记录加载状态 */}
          {isLoadingHistory && (
            <Box
              textAlign="center"
              color="fg.muted"
              py={10}
            >
              <HStack justify="center" mb={2}>
                <Spinner size="sm" />
                <Text fontSize="sm">
                  正在加载历史记录...
                </Text>
              </HStack>
            </Box>
          )}

          {/* 欢迎消息 */}
          {messages.length === 0 && !isLoadingHistory && (
            <Box
              textAlign="center"
              color="fg.muted"
              py={10}
            >
              <Text fontSize="lg" mb={2}>
                🎲 D&D 5e DM AI 助手
              </Text>
              <Text fontSize="sm">
                在右侧编辑区填写相关信息，然后点击发送开始对话
              </Text>
            </Box>
          )}

          {/* 渲染消息列表 */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              timestamp={formatTimestamp(message.timestamp)}
              onRestoreBlock={onRestoreBlock}
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
  onRestoreBlock?: (blockName: string, blockValue: any) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, timestamp, onRestoreBlock }) => {
  const isUser = message.role === 'user';
  const [isExpanded, setIsExpanded] = useState(false);

  // 分块字段名称映射
  const blockNames = {
    current_prompt: '📝 当前问题',
    game_log: '📜 游戏实录',
    module_snippet: '🏛️ 模组片段',
    dm_private: '🔒 DM私记',
    char_status: '👥 角色状态',
    system_prompt: '⚙️ 系统提示词',
    character_cards: '🎭 角色卡',
    items: '🎒 物品清单',
    other: '📦 其他'
  };

  // 复制整个AI回复的Markdown原文
  const handleCopyMarkdown = async () => {
    try {
      // 复制完整的AI回复内容
      await navigator.clipboard.writeText(message.content);
      // 简单提示复制成功（可选）
      console.log('复制成功');
    } catch (error) {
      console.error('复制失败:', error);
      // 降级处理：如果 Clipboard API 不可用，提示用户手动复制
      alert('复制功能不可用，请手动选择并复制文本');
    }
  };
  
  // 恢复单个分块到编辑区
  const handleRestoreBlock = (blockName: string, blockValue: any) => {
    if (onRestoreBlock) {
      onRestoreBlock(blockName, blockValue);
    }
  };

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
        >
          {/* AI消息：Markdown渲染 + 复制功能 */}
          {!isUser ? (
            <VStack align="flex-start" gap={2}>
              {/* Markdown 内容容器 */}
              <Box
                cursor="text"
                position="relative"
                className="markdown-body"
                w="full"
                css={{
                  // 统一基础样式
                  '&': { 
                    whiteSpace: 'normal', 
                    lineHeight: 1.7, 
                    fontSize: '14px' 
                  },
                  
                  // 段落和列表的收口样式
                  '& p': { margin: '0.6em 0' },
                  '& ul, & ol': { 
                    margin: 0, 
                    paddingLeft: '1.5rem' 
                  },
                  
                  // 关键：清除列表项内段落的 margin
                  '& li > p': { 
                    margin: '0.25em 0 !important' 
                  },
                  '& li + li': { 
                    marginTop: '0.25em' 
                  },
                  
                  // 代码块样式
                  '& pre': { 
                    margin: '0.75em 0', 
                    padding: '0.75em 1em', 
                    borderRadius: '8px', 
                    overflow: 'auto' 
                  },
                  '& code': {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace, "Noto Sans Mono CJK SC"',
                    fontSize: '0.95em'
                  },
                  '& pre code': { 
                    fontSize: '0.9em', 
                    lineHeight: 1.5 
                  }
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    // 段落：不再额外添加 margin
                    p: ({ children }) => (
                      <Box as="p" fontSize="sm" lineHeight="1.6">
                        {children}
                      </Box>
                    ),
                    
                    // 列表
                    ul: ({ children }) => <Box as="ul" ml={4}>{children}</Box>,
                    ol: ({ children }) => <Box as="ol" ml={4}>{children}</Box>,
                    
                    // 列表项：确保内部段落 margin 为 0
                    li: ({ children }) => (
                      <Box as="li" css={{ '& > p': { margin: 0 } }}>
                        {children}
                      </Box>
                    ),
                    
                    // 行内代码
                    code: ({ children }) => (
                      <Box as="code" bg="blackAlpha.100" px={1} rounded="sm" fontSize="sm">
                        {children}
                      </Box>
                    ),
                    
                    // 代码块
                    pre: ({ children }) => (
                      <Box bg="blackAlpha.100" p={2} rounded="md" overflow="auto" mb={2}>
                        {children}
                      </Box>
                    ),
                    
                    // 标题
                    h1: ({ children }) => <Text as="h1" fontSize="lg" fontWeight="bold" my={2}>{children}</Text>,
                    h2: ({ children }) => <Text as="h2" fontSize="md" fontWeight="bold" my={2}>{children}</Text>,
                    h3: ({ children }) => <Text as="h3" fontSize="md" fontWeight="bold" my={1}>{children}</Text>,
                    
                    // 分隔线
                    hr: () => <Box as="hr" my={3} borderColor="gray.300" />
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </Box>
              
              {/* 复制整条按钮 */}
              <HStack justify="flex-end" w="full">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleCopyMarkdown}
                  colorPalette="gray"
                >
                  <HStack>
                    <CopyIcon />
                    <Text>复制</Text>
                  </HStack>
                </Button>
              </HStack>
            </VStack>
          ) : (
            /* 用户消息：当前问题 + 展开分块 */
            <VStack align="flex-start" gap={3} w="full">
              {/* 当前问题（始终显示） */}
              <Text fontSize="sm" lineHeight="relaxed">
                {message.content}
              </Text>
              
              {/* 展开/收起按钮 */}
              {message.userBlocks && (
                <HStack w="full" justify="space-between">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setIsExpanded(!isExpanded)}
                    colorPalette="white"
                  >
                    <HStack>
                      <Text>{isExpanded ? '收起详情' : '查看详情'}</Text>
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </HStack>
                  </Button>
                </HStack>
              )}
              
              {/* 展开的分块内容 */}
              {isExpanded && message.userBlocks && (
                <VStack w="full" gap={2} align="stretch">
                  <Separator color="whiteAlpha.300" />
                  
                  {Object.entries(message.userBlocks).map(([key, value]) => {
                    if (key === 'current_prompt') return null; // 当前问题已经显示了
                    
                    const displayValue = typeof value === 'object' 
                      ? JSON.stringify(value, null, 2) 
                      : String(value || '');
                    
                    if (!displayValue.trim()) return null;
                    
                    return (
                      <Box key={key}>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" fontWeight="bold" color="whiteAlpha.800">
                            {blockNames[key as keyof typeof blockNames] || key}
                          </Text>
                          
                          {/* 恢复按钮 */}
                          <Button
                            size="xs"
                            variant="solid"
                            colorPalette="green"
                            onClick={() => handleRestoreBlock(key, value)}
                          >
                            恢复
                          </Button>
                        </HStack>
                        
                        {/* 分块内容预览（有高度限制） */}
                        <Box
                          bg="whiteAlpha.200"
                          rounded="md"
                          p={2}
                          maxH="120px"
                          overflowY="auto"
                          fontSize="xs"
                          fontFamily="mono"
                          whiteSpace="pre-wrap"
                          css={{
                            '&::-webkit-scrollbar': {
                              width: '4px'
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'transparent'
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: 'rgba(255,255,255,0.3)',
                              borderRadius: '2px'
                            }
                          }}
                        >
                          {displayValue}
                        </Box>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </VStack>
          )}
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