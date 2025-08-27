// IndexedDB 本地缓存服务 - 用于保存用户编辑状态，防止数据丢失

import { UserInputBlocks, LocalCacheState } from './types';

// IndexedDB 配置常量
const DB_NAME = 'DnDDMAssistant';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const CACHE_KEY = 'currentState';

/**
 * IndexedDB 缓存管理类
 * 负责本地存储用户的编辑状态，实现自动保存和恢复功能
 */
class LocalCacheService {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库连接
   * 创建对象存储空间，设置主键
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 打开或创建 IndexedDB 数据库
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 初始化失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 初始化成功');
        resolve();
      };

      // 数据库版本更新或首次创建时触发
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储空间，使用 'key' 作为主键
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          console.log('创建缓存对象存储空间');
        }
      };
    });
  }

  /**
   * 保存用户输入块到本地缓存
   * @param blocks - 8个分块的用户输入数据
   */
  async saveBlocks(blocks: UserInputBlocks): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const cacheData: LocalCacheState = {
      currentBlocks: blocks,
      lastUpdated: Date.now()
    };

    return new Promise((resolve, reject) => {
      // 开启读写事务
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // 存储数据，key 固定为 CACHE_KEY
      const request = store.put({
        key: CACHE_KEY,
        ...cacheData
      });

      request.onsuccess = () => {
        console.log('本地缓存保存成功');
        resolve();
      };

      request.onerror = () => {
        console.error('本地缓存保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 从本地缓存加载用户输入块
   * @returns 缓存的分块数据，如果不存在则返回默认空值
   */
  async loadBlocks(): Promise<UserInputBlocks> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => {
        if (request.result) {
          const cacheData = request.result as LocalCacheState & { key: string };
          console.log('从本地缓存加载数据成功，最后更新时间:', new Date(cacheData.lastUpdated));
          resolve(cacheData.currentBlocks);
        } else {
          // 如果没有缓存数据，返回默认空值
          console.log('未找到本地缓存，返回默认空值');
          resolve(this.getDefaultBlocks());
        }
      };

      request.onerror = () => {
        console.error('加载本地缓存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清除本地缓存
   */
  async clearCache(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);

      request.onsuccess = () => {
        console.log('本地缓存已清除');
        resolve();
      };

      request.onerror = () => {
        console.error('清除本地缓存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取默认的空分块数据
   */
  private getDefaultBlocks(): UserInputBlocks {
    return {
      current_prompt: '',
      game_log: '',
      module_snippet: '',
      dm_private: '',
      char_status: {},
      system_prompt: '',
      character_cards: {},
      items: {},
      other: ''
    };
  }

  /**
   * 检查缓存是否存在
   */
  async hasCache(): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// 导出单例实例
export const localCache = new LocalCacheService();