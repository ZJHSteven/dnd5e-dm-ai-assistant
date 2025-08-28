# D&D 5e DM AI 助手项目规格

## 项目描述
为 D&D 5e 文字跑团 DM 开发的上下文管理工具，解决长时跑团中 AI 对话的核心痛点：上下文膨胀、记忆错乱、状态丢失。

## 当前项目状态
✅ **后端API完成**: Hono + Cloudflare Workers 服务已实现 (`src/index.ts`)  
✅ **数据库完成**: D1 SQLite 表结构和索引已就绪 (`schema.sql`)  
✅ **前端框架完成**: React + TypeScript + Chakra UI v3 配置完成  
✅ **部署配置完成**: Wrangler 配置和 D1 数据库绑定完成  
✅ **环境变量已配置**: API_KEY 和 BASE_URL 已设置为 Worker secrets  
✅ **项目已部署**: 成功部署到 https://dnd5e-dm-ai-assistant.zhangjiahe0830.workers.dev  
✅ **基础功能测试**: 健康检查接口和历史记录接口正常工作  
🔧 **LLM API调用问题**: 需要调试 LLM API 响应解析问题  
🚧 **前端组件待实现**: 8个分块编辑组件和聊天界面组件

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

## 后端API设计 ✅已实现

### 环境变量配置
当前存储在 `.vars` 文件中：
```
API_KEY=sk-fTt74UbQL1nUwBH8e2gPt5F3UuceIMxcoV1rf2Z2k6NLCtIC
BASE_URL=https://yunwu.ai
```

### 已实现的API路由
```typescript
// ✅ POST /api/chat - 聊天API转发 (已实现)
// 接收8个分块JSON -> 拼装提示词 -> 转发到LLM -> 保存到D1 -> 返回响应

// ✅ GET /api/history - 获取历史对话 (已实现)  
// 支持分页查询：?page=1&limit=20

// ✅ DELETE /api/history/:timestamp - 删除历史记录 (已实现)

// ✅ GET /health - 健康检查接口 (已实现)

// ✅ GET * - 静态资源托管 (已实现)
// SPA路由支持，404时返回index.html
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

### ✅ P0 - 核心后端功能（已完成）
- [x] 基础API转发（`src/index.ts` - 完整实现）
- [x] D1数据存储（数据库表结构和操作函数）
- [x] 聊天请求处理（8个分块拼装提示词）
- [x] 历史记录管理（分页查询、删除功能）
- [x] 静态资源托管（SPA路由支持）

### 🚧 P0 - 核心前端功能（待实现）
- [ ] 8个分块输入组件（鼠标悬停自动展开/折叠）
- [ ] 聊天界面（消息列表显示）
- [ ] IndexedDB本地缓存（编辑状态持久化）
- [ ] 与后端API集成（发送聊天请求）

### 🔧 P0 - 部署配置（待完成）
- [ ] 配置 Cloudflare Worker 环境变量（API_KEY, BASE_URL）
- [ ] 创建和迁移D1数据库
- [ ] 前端构建并部署到 Workers
- [ ] 端到端功能测试

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

## 当前测试状态

### ✅ 成功的功能
- **部署状态**: 项目已成功部署到 Cloudflare Workers
- **健康检查**: `GET /health` 接口正常返回状态信息
- **历史记录**: `GET /api/history` 接口正常返回空历史记录列表
- **静态资源**: 前端React应用可以正常访问
- **数据库**: D1数据库表结构已成功创建（本地和远程）

### 🔧 需要修复的问题
- **LLM API集成**: `POST /api/chat` 接口调用时出现JSON解析错误
  - 错误信息: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
  - 可能原因: LLM API端点问题或认证失败
  - 建议: 检查 `BASE_URL=https://yunwu.ai` 的API兼容性

### 📋 下一步行动计划
1. **调试LLM API**: 验证 yunwu.ai API 端点和认证方式
2. **完成前端组件**: 实现8个分块编辑组件
3. **集成测试**: 确保前后端完整工作流程
4. **用户界面优化**: 实现半屏友好设计