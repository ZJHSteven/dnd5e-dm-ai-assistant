// 类型定义 - 定义整个应用的数据结构

// 8个分块数据的结构定义
export interface UserInputBlocks {
  /** 当前问题 - 用户想询问AI的具体问题 */
  current_prompt: string;
  
  /** 游戏实录 - 已发生的游戏内容和对话记录 */
  game_log: string;
  
  /** 模组片段 - 相关的模组背景、剧情、NPC信息等 */
  module_snippet: string;
  
  /** DM私记 - 仅DM知道的隐秘信息，不会被玩家看到 */
  dm_private: string;
  
  /** 角色状态 - 当前各角色的HP、状态效果、位置等 */
  char_status: Record<string, any>;
  
  /** 系统提示词 - 给AI的行为指导和角色设定 */
  system_prompt: string;
  
  /** 角色卡 - 完整的PC/NPC角色信息 */
  character_cards: Record<string, any>;
  
  /** 物品清单 - 角色持有的物品、装备、魔法物品等 */
  items: Record<string, any>;
  
  /** 其他 - 杂项信息和临时笔记 */
  other: string;
}

// 数据库记录结构
export interface ConversationRecord {
  /** UTC时间戳，用作主键 */
  time_stamp: number;
  
  /** JSON序列化的用户输入分块数据 */
  user_input: string; // JSON.stringify(UserInputBlocks)
  
  /** AI回复内容 */
  ai_response: string;
  
  /** 记录创建时间 */
  created_at?: string;
}

// API 请求/响应类型
export interface ChatRequest {
  /** 8个分块的输入数据 */
  blocks: UserInputBlocks;
  
  /** 选择的AI模型 */
  model?: string;
  
  /** 其他模型参数 */
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  /** AI回复内容 */
  content: string;
  
  /** 本次对话的时间戳ID */
  timestamp: number;
  
  /** 错误信息（如果有） */
  error?: string;
}

// 本地缓存数据结构（IndexedDB）
export interface LocalCacheState {
  /** 当前编辑的分块数据 */
  currentBlocks: UserInputBlocks;
  
  /** 最后更新时间 */
  lastUpdated: number;
}

// 分块组件的配置信息
export interface BlockConfig {
  /** 分块的唯一标识 */
  key: keyof UserInputBlocks;
  
  /** 显示名称 */
  title: string;
  
  /** 图标emoji */
  icon: string;
  
  /** 是否默认展开 */
  defaultExpanded: boolean;
  
  /** 特殊样式类名 */
  className?: string;
  
  /** 占位符文本 */
  placeholder?: string;
}