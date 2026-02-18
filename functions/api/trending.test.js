import { describe, it, expect, vi } from 'vitest';
import { onRequest } from './trending.js';

describe('Trending API Unit Tests', () => {
    
    // 基础 Mock 数据库结构
    const createMockDB = (lastCaptureVal, resultsVal = []) => ({
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(lastCaptureVal),
        all: vi.fn().mockResolvedValue({ results: resultsVal }),
    });

    it('应该使用默认参数正确处理请求', async () => {
        const mockDB = createMockDB({ captured_at: '2026-02-17 10:00:00' }, []);
        const context = {
            request: new Request('https://api.trendingai.cn/api/trending'),
            env: { DB: mockDB }
        };

        const response = await onRequest(context);
        const result = await response.json();

        expect(result.success).toBe(true);
        expect(result.metadata.summary_lang).toBe('en');
        expect(result.metadata.since).toBe('daily');
        expect(result.metadata.batch).toBe('am'); // 10:00 是上午
    });

    it('当传入非法 limit 时应该回退到默认值 25', async () => {
        const mockDB = createMockDB({ captured_at: '2026-02-17 10:00:00' }, []);
        const context = {
            request: new Request('https://api.trendingai.cn/api/trending?limit=abc'),
            env: { DB: mockDB }
        };

        await onRequest(context);
        
        // 校验 prepare 的第二个调用（数据查询）绑定的参数
        // 顺序：providers..., since, lang, targetTime, limit
        const dataParams = mockDB.bind.mock.calls[1];
        expect(dataParams[dataParams.length - 1]).toBe(25);
    });

    it('应该根据 summary_lang 提取对应的 AI 总结内容', async () => {
        const mockResults = [{
            rank: 1,
            repoName: 'test-repo',
            aiSummaries: JSON.stringify([{
                provider: 'deepseek',
                translations: { zh: '这是中文', en: 'This is English' }
            }]),
            builtBy: '[]'
        }];

        const mockDB = createMockDB({ captured_at: '2026-02-17 15:00:00' }, mockResults);
        
        const context = {
            request: new Request('https://api.trendingai.cn/api/trending?summary_lang=zh'),
            env: { DB: mockDB }
        };

        const response = await onRequest(context);
        const result = await response.json();

        expect(result.data[0].aiSummaries[0].content).toBe('这是中文');
        expect(result.metadata.batch).toBe('pm'); // 15:00 是下午
    });

    it('支持多选 provider 过滤', async () => {
        const mockDB = createMockDB({ captured_at: '2026-02-17 10:00:00' }, []);
        const context = {
            request: new Request('https://api.trendingai.cn/api/trending?provider=chatgpt,deepseek'),
            env: { DB: mockDB }
        };

        await onRequest(context);

        // 校验 SQL 是否生成了两个问号
        const sql = mockDB.prepare.mock.calls[1][0];
        expect(sql).toContain('provider IN (?,?)');
        
        // 校验参数绑定
        const dataParams = mockDB.bind.mock.calls[1];
        expect(dataParams[0]).toBe('chatgpt');
        expect(dataParams[1]).toBe('deepseek');
    });

    it('如果没有数据应该返回 count 为 0 的结果', async () => {
        const mockDB = createMockDB(null); // 找不到 snapshot
        const context = {
            request: new Request('https://api.trendingai.cn/api/trending'),
            env: { DB: mockDB }
        };

        const response = await onRequest(context);
        const result = await response.json();

        expect(result.success).toBe(true);
        expect(result.count).toBe(0);
        expect(result.data).toEqual([]);
    });
});
