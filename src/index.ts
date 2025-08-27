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
    
    // 转发到LLM API
    const llmResponse = await forwardToLLM(prompt, {
      model: request.model || 'gpt-3.5-turbo',
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 2000
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
 * 组装8个分块为完整提示词
 */
function assemblePrompt(blocks: UserInputBlocks): string {
  const parts = [];

  // 系统提示词放在最前面
  if (blocks.system_prompt.trim()) {
    parts.push('=== SYSTEM PROMPT ===');
    parts.push(blocks.system_prompt);
    parts.push('');
  }

  // 角色卡信息
  if (blocks.character_cards && Object.keys(blocks.character_cards).length > 0) {
    parts.push('=== CHARACTER CARDS ===');
    if (typeof blocks.character_cards === 'string') {
      parts.push(blocks.character_cards);
    } else {
      parts.push(JSON.stringify(blocks.character_cards, null, 2));
    }
    parts.push('');
  }

  // 当前角色状态
  if (blocks.char_status && Object.keys(blocks.char_status).length > 0) {
    parts.push('=== CHARACTER STATUS ===');
    if (typeof blocks.char_status === 'string') {
      parts.push(blocks.char_status);
    } else {
      parts.push(JSON.stringify(blocks.char_status, null, 2));
    }
    parts.push('');
  }

  // 游戏实录
  if (blocks.game_log.trim()) {
    parts.push('=== GAME LOG ===');
    parts.push(blocks.game_log);
    parts.push('');
  }

  // 模组片段
  if (blocks.module_snippet.trim()) {
    parts.push('=== MODULE SNIPPET ===');
    parts.push(blocks.module_snippet);
    parts.push('');
  }

  // 物品清单
  if (blocks.items && Object.keys(blocks.items).length > 0) {
    parts.push('=== ITEMS ===');
    if (typeof blocks.items === 'string') {
      parts.push(blocks.items);
    } else {
      parts.push(JSON.stringify(blocks.items, null, 2));
    }
    parts.push('');
  }

  // DM私记
  if (blocks.dm_private.trim()) {
    parts.push('=== DM PRIVATE ===');
    parts.push(blocks.dm_private);
    parts.push('');
  }

  // 其他信息
  if (blocks.other.trim()) {
    parts.push('=== OTHER ===');
    parts.push(blocks.other);
    parts.push('');
  }

  // 当前问题放在最后
  parts.push('=== CURRENT PROMPT ===');
  parts.push(blocks.current_prompt);

  return parts.join('\n');
}

/**
 * 转发请求到LLM API
 */
async function forwardToLLM(
  prompt: string, 
  options: { model: string; temperature: number; max_tokens: number },
  apiKey: string,
  baseUrl: string
): Promise<{ content: string }> {
  
  // 构建请求体（适配OpenAI格式）
  const requestBody = {
    model: options.model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    stream: false
  };

  // 发送请求
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`LLM API 请求失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  
  // 解析响应
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('LLM API 返回格式错误');
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
