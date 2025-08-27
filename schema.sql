-- D&D 5e DM AI 助手数据库表结构
-- 单表设计，存储所有聊天记录和上下文信息

CREATE TABLE IF NOT EXISTS conversations (
  -- 使用 UTC 时间戳作为主键，确保唯一性和时间排序
  time_stamp INTEGER PRIMARY KEY,
  
  -- JSON 格式存储 8 个分块内容
  -- 包含：当前问题、游戏实录、模组片段、DM私记、角色状态、系统提示词、角色卡、物品清单、其他
  user_input TEXT NOT NULL,
  
  -- AI 回复的文本内容
  ai_response TEXT NOT NULL,
  
  -- 创建时间索引，便于按时间查询历史记录
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建时间戳索引，优化历史查询性能
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(time_stamp DESC);

-- 创建时间索引，用于日期范围查询
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);