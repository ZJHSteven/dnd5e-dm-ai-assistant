// D&D 5e DM AI 助手 - Cloudflare Worker 主入口
// 基于 Hono 框架构建 API 服务，支持聊天转发和历史记录存储

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { ChatRequest, ChatResponse, ConversationRecord, UserInputBlocks } from './types';

// 环境变量类型定义
interface Env {
  DB: D1Database;           // D1 数据库绑定
  API_KEY: string;          // LLM API 密钥
  BASE_URL: string;         // LLM API 基础URL
  ASSETS: Fetcher;          // 静态资源绑定
}

// 创建 Hono 应用实例
const app = new Hono<{ Bindings: Env }>();

// 配置 CORS - 允许前端跨域请求
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/**
 * 健康检查接口
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'D&D 5e DM AI Assistant'
  });
});

/**
 * 聊天API - 转发请求到LLM提供商并保存记录
 */
app.post('/api/chat', async (c) => {
  try {
    const request: ChatRequest = await c.req.json();
    const { DB, API_KEY, BASE_URL } = c.env;

    // 验证请求数据
    if (!request.blocks || !request.blocks.current_prompt) {
      return c.json({ 
        error: '当前问题不能为空' 
      }, 400);
    }

    // 组装提示词
    const prompt = assemblePrompt(request.blocks);
    
    // 转发到LLM API - 使用默认参数，不限制最大tokens和温度
    const llmResponse = await forwardToLLM(prompt, request.blocks, {
      model: request.model || 'gemini-2.5-flash'
    }, API_KEY, BASE_URL);

    // 生成时间戳ID
    const timestamp = Date.now();

    // 保存到数据库
    await saveConversation(DB, {
      time_stamp: timestamp,
      user_input: JSON.stringify(request.blocks),
      ai_response: llmResponse.content
    });

    // 返回响应
    const response: ChatResponse = {
      content: llmResponse.content,
      timestamp,
    };

    return c.json(response);

  } catch (error) {
    console.error('聊天API错误:', error);
    return c.json({ 
      error: '处理请求时出现错误，请稍后重试' 
    }, 500);
  }
});

/**
 * 获取历史对话记录
 */
app.get('/api/history', async (c) => {
  try {
    const { DB } = c.env;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    // 查询历史记录
    const stmt = DB.prepare(`
      SELECT time_stamp, user_input, ai_response, created_at 
      FROM conversations 
      ORDER BY time_stamp DESC 
      LIMIT ? OFFSET ?
    `);
    
    const { results } = await stmt.bind(limit, offset).all();

    // 获取总数
    const countStmt = DB.prepare('SELECT COUNT(*) as total FROM conversations');
    const { results: countResults } = await countStmt.all();
    const total = (countResults?.[0] as any)?.total || 0;

    return c.json({
      conversations: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取历史记录错误:', error);
    return c.json({ 
      error: '获取历史记录失败' 
    }, 500);
  }
});

/**
 * 删除历史记录
 */
app.delete('/api/history/:timestamp', async (c) => {
  try {
    const { DB } = c.env;
    const timestamp = parseInt(c.req.param('timestamp') || '0');

    const stmt = DB.prepare('DELETE FROM conversations WHERE time_stamp = ?');
    const result = await stmt.bind(timestamp).run();

    if (!result.success) {
      return c.json({ error: '记录不存在' }, 404);
    }

    return c.json({ success: true });

  } catch (error) {
    console.error('删除历史记录错误:', error);
    return c.json({ 
      error: '删除记录失败' 
    }, 500);
  }
});

/**
 * 组装非系统提示词的其他分块 - 不包含系统提示词
 */
function assemblePrompt(blocks: UserInputBlocks): string {
  const parts = [];

  // 按照项目文档规定的顺序进行拼接，但不包含系统提示词
  
  // 1. 角色卡
  if (blocks.character_cards) {
    parts.push('=== CHARACTER CARDS ===');
    if (typeof blocks.character_cards === 'string') {
      parts.push(blocks.character_cards);
    } else {
      parts.push(JSON.stringify(blocks.character_cards, null, 2));
    }
    parts.push('');
  }

  // 2. 角色状态
  if (blocks.char_status) {
    parts.push('=== CHARACTER STATUS ===');
    if (typeof blocks.char_status === 'string') {
      parts.push(blocks.char_status);
    } else {
      parts.push(JSON.stringify(blocks.char_status, null, 2));
    }
    parts.push('');
  }

  // 3. 游戏实录
  if (blocks.game_log && blocks.game_log.trim()) {
    parts.push('=== GAME LOG ===');
    parts.push(blocks.game_log);
    parts.push('');
  }

  // 4. 模组片段
  if (blocks.module_snippet && blocks.module_snippet.trim()) {
    parts.push('=== MODULE SNIPPET ===');
    parts.push(blocks.module_snippet);
    parts.push('');
  }

  // 5. 物品清单
  if (blocks.items) {
    parts.push('=== ITEMS ===');
    if (typeof blocks.items === 'string') {
      parts.push(blocks.items);
    } else {
      parts.push(JSON.stringify(blocks.items, null, 2));
    }
    parts.push('');
  }

  // 6. DM私记
  if (blocks.dm_private && blocks.dm_private.trim()) {
    parts.push('=== DM PRIVATE ===');
    parts.push(blocks.dm_private);
    parts.push('');
  }

  // 7. 其他信息
  if (blocks.other && blocks.other.trim()) {
    parts.push('=== OTHER ===');
    parts.push(blocks.other);
    parts.push('');
  }

  // 8. 当前问题 - 必须放在最后
  parts.push('=== CURRENT PROMPT ===');
  parts.push(blocks.current_prompt);

  return parts.join('\n');
}

/**
 * 转发请求到LLM API - 正确处理系统提示词和用户消息
 */
async function forwardToLLM(
  userPrompt: string,
  blocks: UserInputBlocks, 
  options: { model: string },
  apiKey: string,
  baseUrl: string
): Promise<{ content: string }> {
  
  // 构建标准OpenAI格式的消息数组
  const messages: Array<{ role: string; content: string }> = [];
  
  // 如果有系统提示词，作为system角色消息
  if (blocks.system_prompt && blocks.system_prompt.trim()) {
    messages.push({
      role: 'system',
      content: blocks.system_prompt
    });
  }
  
  // 用户消息包含其他所有内容
  messages.push({
    role: 'user',
    content: userPrompt
  });

  // 配置D&D跑团优化的LLM参数
  // - 高温度(1.75)增加创造性，适合跑团场景的随机性和想象力
  // - 频率惩罚(0.15)减少词汇重复，让描述更丰富多样
  // - 存在惩罚(0.14)避免过度重复已出现的概念
  // - top_p(0.91)在保持创造性的同时防止完全随机
  const requestBody = {
    model: options.model,
    messages: messages,
    stream: false,
    temperature: 1.75,        // 高创造性输出，适合跑团场景
    frequency_penalty: 0.15,  // 减少词汇重复
    presence_penalty: 0.14,   // 避免概念重复
    top_p: 0.91              // 限制token选择范围，保持连贯性
  };

  // 发送请求到LLM API
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as any;
  
  // 解析OpenAI标准格式的响应
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('LLM API 返回格式错误: ' + JSON.stringify(data));
  }

  return {
    content: data.choices[0].message.content
  };
}

/**
 * 保存对话记录到D1数据库
 */
async function saveConversation(
  db: D1Database, 
  record: ConversationRecord
): Promise<void> {
  
  const stmt = db.prepare(`
    INSERT INTO conversations (time_stamp, user_input, ai_response)
    VALUES (?, ?, ?)
  `);
  
  await stmt.bind(
    record.time_stamp,
    record.user_input,
    record.ai_response
  ).run();
}

/**
 * 托管静态资源 - 当请求不匹配API路由时，返回前端文件
 */
app.get('*', async (c) => {
  const { ASSETS } = c.env;
  
  // 尝试获取静态资源
  const response = await ASSETS.fetch(c.req.raw);
  
  if (response.status === 404) {
    // 如果是SPA路由，返回index.html
    const indexResponse = await ASSETS.fetch(new Request('https://example.com/index.html'));
    return indexResponse;
  }
  
  return response;
});

// 导出 Cloudflare Worker 处理器
export default {
  fetch: app.fetch
} satisfies ExportedHandler<Env>;
