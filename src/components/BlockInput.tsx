// 分块输入组件 - 实现8个可折叠的输入区域

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Textarea,
  HStack,
  VStack,
  Text,
  Collapsible,
  Badge,
  Field
} from '@chakra-ui/react';
import { UserInputBlocks, BlockConfig } from '../types';

// 8个分块的配置信息
const BLOCK_CONFIGS: BlockConfig[] = [
  {
    key: 'current_prompt',
    title: '当前问题',
    icon: '📝',
    defaultExpanded: true,
    placeholder: '请输入你想询问AI的具体问题...'
  },
  {
    key: 'game_log',
    title: '游戏实录',
    icon: '📜',
    defaultExpanded: false,
    placeholder: '记录已发生的游戏内容、对话、行动等...'
  },
  {
    key: 'module_snippet',
    title: '模组片段',
    icon: '🏛️',
    defaultExpanded: false,
    placeholder: '粘贴相关的模组背景、剧情、NPC信息等...'
  },
  {
    key: 'dm_private',
    title: 'DM私记',
    icon: '🔒',
    defaultExpanded: true,
    className: 'dm-private',
    placeholder: '仅DM知道的机密信息，不会被玩家看到...'
  },
  {
    key: 'char_status',
    title: '角色状态',
    icon: '👥',
    defaultExpanded: true,
    placeholder: '当前各角色的HP、状态效果、位置等信息...'
  },
  {
    key: 'system_prompt',
    title: '系统提示词',
    icon: '⚙️',
    defaultExpanded: false,
    placeholder: '给AI的行为指导和角色设定...'
  },
  {
    key: 'character_cards',
    title: '角色卡',
    icon: '🎭',
    defaultExpanded: false,
    placeholder: '完整的PC/NPC角色信息...'
  },
  {
    key: 'items',
    title: '物品清单',
    icon: '🎒',
    defaultExpanded: false,
    placeholder: '角色持有的物品、装备、魔法物品等...'
  },
  {
    key: 'other',
    title: '其他',
    icon: '📦',
    defaultExpanded: false,
    placeholder: '杂项信息和临时笔记...'
  }
];

interface BlockInputProps {
  value: UserInputBlocks;
  onChange: (blocks: UserInputBlocks) => void;
}

// 单个分块组件
interface SingleBlockProps {
  config: BlockConfig;
  value: string | Record<string, any>;
  onChange: (key: keyof UserInputBlocks, value: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const SingleBlock: React.FC<SingleBlockProps> = ({
  config,
  value,
  onChange,
  isExpanded,
  onToggle
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理值的显示（对象类型转换为字符串）
  const displayValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  
  // 获取预览文本（最后一行或前50个字符）
  const previewText = displayValue.split('\n').slice(-1)[0] || displayValue.slice(0, 50);

  // 输入变化处理
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue: string = e.target.value;
    
    // 对于 char_status, character_cards, items 尝试解析为 JSON
    if (['char_status', 'character_cards', 'items'].includes(config.key)) {
      try {
        if (newValue.trim()) {
          JSON.parse(newValue); // 验证JSON格式
        }
      } catch (e) {
        // 如果JSON格式错误，保持字符串格式
      }
    }
    
    onChange(config.key, newValue);
  }, [config.key, onChange]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current && isExpanded) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(textarea.scrollHeight, 120) + 'px';
    }
  }, [displayValue, isExpanded]);

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      overflow="hidden"
      transition="all 0.2s"
      bg={config.className === 'dm-private' ? 'red.50' : 'bg'}
      borderColor={config.className === 'dm-private' ? 'red.200' : 'border'}
      _hover={{ borderColor: 'blue.300' }}
    >
      <Collapsible.Root open={isExpanded}>
        {/* 标题栏 */}
        <Collapsible.Trigger
          w="full"
          p={3}
          cursor="pointer"
          onClick={onToggle}
          _hover={{ bg: 'gray.50' }}
          transition="background 0.2s"
        >
          <HStack justify="space-between" w="full">
            <HStack>
              <Text fontSize="lg">{config.icon}</Text>
              <Text fontWeight="medium" color="fg">
                {config.title}
              </Text>
              {config.className === 'dm-private' && (
                <Badge colorPalette="red" variant="solid" size="sm">
                  机密
                </Badge>
              )}
            </HStack>
            
            {/* 折叠状态下显示预览 */}
            {!isExpanded && previewText && (
              <Text fontSize="sm" color="fg.muted" lineClamp={1} maxW="300px">
                {previewText}...
              </Text>
            )}
            
            {/* 展开/折叠指示器 */}
            <Text fontSize="sm" color="fg.muted">
              {isExpanded ? '▼' : '▶'}
            </Text>
          </HStack>
        </Collapsible.Trigger>

        {/* 内容区域 */}
        <Collapsible.Content>
          <Box p={3} pt={0}>
            <Field.Root>
              <Textarea
                ref={textareaRef}
                value={displayValue}
                onChange={handleChange}
                placeholder={config.placeholder}
                minH="120px"
                autoresize
                variant="outline"
                resize="vertical"
                bg={config.className === 'dm-private' ? 'red.25' : 'bg'}
                borderColor={config.className === 'dm-private' ? 'red.200' : 'border'}
                _focus={{
                  borderColor: config.className === 'dm-private' ? 'red.400' : 'blue.400',
                  boxShadow: `0 0 0 1px ${config.className === 'dm-private' ? 'var(--chakra-colors-red-400)' : 'var(--chakra-colors-blue-400)'}`
                }}
              />
              {config.key === 'dm_private' && (
                <Field.HelperText color="red.600">
                  此内容为DM专用机密信息
                </Field.HelperText>
              )}
            </Field.Root>
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

// 主分块输入组件
export const BlockInput: React.FC<BlockInputProps> = ({ value, onChange }) => {
  // 管理每个分块的展开状态
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    BLOCK_CONFIGS.forEach(config => {
      initial[config.key] = config.defaultExpanded;
    });
    return initial;
  });

  // 切换展开状态
  const toggleExpanded = useCallback((key: string) => {
    setExpandedStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // 处理单个分块数据变化
  const handleBlockChange = useCallback((key: keyof UserInputBlocks, newValue: string) => {
    onChange({
      ...value,
      [key]: newValue
    });
  }, [value, onChange]);

  return (
    <VStack gap={2} align="stretch" w="full">
      {/* 分块标题 */}
      <HStack mb={2}>
        <Text fontSize="lg" fontWeight="bold" color="fg">
          🎲 分块编辑区
        </Text>
        <Text fontSize="sm" color="fg.muted">
          （点击箭头手动展开）
        </Text>
      </HStack>

      {/* 渲染所有分块 */}
      {BLOCK_CONFIGS.map(config => (
        <SingleBlock
          key={config.key}
          config={config}
          value={value[config.key]}
          onChange={handleBlockChange}
          isExpanded={expandedStates[config.key]}
          onToggle={() => toggleExpanded(config.key)}
        />
      ))}
    </VStack>
  );
};