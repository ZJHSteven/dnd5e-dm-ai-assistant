# D&D 5e DM AI 助手项目规格

## 项目描述
为 D&D 5e 文字跑团 DM 开发的上下文管理工具，解决长时跑团中 AI 对话的核心痛点：上下文膨胀、记忆错乱、状态丢失。

## 核心功能需求
- 分块管理跑团信息（8个模块：当前问题、游戏实录、模组片段、DM私记、角色状态、系统提示词、角色卡、物品清单、其他）
- 云端优先存储（D1数据库）
- 本地缓存编辑状态（IndexedDB）
- API代理转发到LLM提供商
- 半屏友好的UI设计

## 技术栈
- **前端**: React + TypeScript + Vite + Chakra UI v3
- **后端**: Cloudflare Workers + Hono
- **数据库**: D1 (SQLite)
- **部署**: Cloudflare Workers
- **本地存储**: IndexedDB

## 数据模型

### D1表结构（仅一张表）
```sql
CREATE TABLE conversations (
  time_stamp INTEGER PRIMARY KEY,  -- UTF时间戳作为唯一ID
  user_input TEXT,                 -- JSON格式存储8个分块内容
  ai_response TEXT                 -- AI回复文本
);
```

### user_input JSON结构
```json
{
  "current_prompt": "当前问题内容",
  "game_log": "游戏实录内容", 
  "module_snippet": "模组片段内容",
  "dm_private": "DM私记内容",
  "char_status": {"角色状态JSON": "嵌套结构"},
  "system_prompt": "系统提示词内容",
  "character_cards": {"角色卡JSON": "完整角色信息"},
  "items": {"物品清单JSON": "所有物品信息"},
  "other": "其他/杂项内容"
}
```

## 前端界面设计（半屏优化）

### 垂直布局结构
```
┌────────────────────────────────────┐
│ [模型选择] [Token估算] [发送] [设置] │
├────────────────────────────────────┤
│                                    │
│        聊天区域                     │
│   ┌─ AI ────────────────────────   │
│   │ 回复内容...                    │
│   └────────────────────────────    │
│   ┌── 你 ─────────────────────────  │
│   │ 问题...                        │
│   └────────────────────────────    │
│                                    │
├────────────────────────────────────┤
│ 🎲 分块编辑区（鼠标悬停自动展开）    │
│ ├ 📝 当前问题 [展开]               │
│ ├ 📜 游戏实录 [折叠显示最后一行]    │
│ ├ 🏛️ 模组片段 [折叠显示最后一行]    │  
│ ├ 🔒 DM私记 [展开]                │
│ ├ 👥 角色状态 [展开]               │
│ ├ ⚙️ 系统提示词 [折叠显示最后一行]   │
│ ├ 🎭 角色卡 [折叠显示最后一行]      │
│ ├ 🎒 物品清单 [折叠显示最后一行]    │
│ └ 📦 其他 [折叠显示最后一行]       │
├────────────────────────────────────┤
│ 📊 Token预览: ~1.2k tokens        │
└────────────────────────────────────┘
```

### 分块模块设计
- **当前问题**: 大文本框，默认展开
- **游戏实录**: 大文本框，鼠标悬停展开，折叠时显示最后一行
- **模组片段**: 大文本框，鼠标悬停展开，折叠时显示最后一行  
- **DM私记**: 大文本框，红色边框标示保密，默认展开
- **角色状态**: 大文本框，默认展开
- **系统提示词**: 大文本框，鼠标悬停展开
- **角色卡**: 大文本框，鼠标悬停展开
- **物品清单**: 大文本框，鼠标悬停展开
- **其他**: 大文本框，鼠标悬停展开

## 后端API设计

### 环境变量
```
API_KEY=xxx
BASE_URL=xxx
```

### API路由（Hono）
```typescript
// POST /api/chat - 转发聊天请求
app.post('/api/chat', async (c) => {
  // 1. 接收前端8个分块JSON和模型参数
  // 2. 拼装成合适的提示词格式
  // 3. 转发到LLM API
  // 4. 流式返回响应
  // 5. 完成后保存到D1
})

// GET /api/history - 获取历史对话
app.get('/api/history', async (c) => {
  // 分页返回历史对话记录
})
```

### 提示词拼装策略
将8个分块用标识符分割，组装成一条完整提示词：
```
=== SYSTEM PROMPT ===
{system_prompt}

=== CHARACTER CARDS ===  
{character_cards}

=== CHARACTER STATUS ===
{char_status}

=== GAME LOG ===
{game_log}

=== MODULE SNIPPET ===
{module_snippet}

=== ITEMS ===
{items}

=== DM PRIVATE ===
{dm_private}

=== OTHER ===
{other}

=== CURRENT PROMPT ===
{current_prompt}
```

## 本地缓存设计

### IndexedDB存储
```javascript
// 仅缓存当前编辑状态
const cacheSchema = {
  currentState: {
    current_prompt: string,
    game_log: string, 
    module_snippet: string,
    dm_private: string,
    char_status: string,
    system_prompt: string,
    character_cards: string,
    items: string,
    other: string
  }
}
```

### 缓存策略
- 用户输入时500ms防抖自动保存到IndexedDB
- 发送成功后保留缓存（便于继续编辑）
- 页面加载时从IndexedDB恢复编辑状态

## 开发优先级

### P0 - 核心功能
- [ ] 8个分块输入组件（鼠标悬停自动展开/折叠）
- [ ] 聊天界面（消息列表）
- [ ] IndexedDB本地缓存
- [ ] 基础API转发
- [ ] D1数据存储

### P1 - 完善功能  
- [ ] 模型选择器
- [ ] 历史对话加载
- [ ] Token粗略估算
- [ ] 导入导出功能

### P2 - 优化体验
- [ ] 响应式布局优化
- [ ] 快捷键支持
- [ ] 搜索历史功能

## 技术约束
- 界面必须支持半屏使用（宽度~960px）
- 数据存储简化为单表结构
- 后端仅负责API转发和数据缓存
- 前端采用垂直布局，避免左右分屏

## 验收标准
- [ ] 半屏模式下界面完整可用
- [ ] 8个分块可独立编辑，鼠标悬停自动展开
- [ ] 折叠时显示最后一行内容预览
- [ ] 页面刷新后编辑状态完全恢复
- [ ] 成功转发请求到LLM并显示响应
- [ ] 对话记录正确保存到D1数据库