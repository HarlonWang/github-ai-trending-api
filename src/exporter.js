import fs from 'node:fs/promises';
import path from 'node:path';
import { getLatestTrending } from './db.js';

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 从数据库读取最新数据并导出为 API 所需的 JSON 文件
 * @param {string} since - 时间周期
 * @param {string} language - 语言名称
 * @param {string} capturedAt - 本次抓取的记录时间点（用于写入 JSON 头部）
 */
export async function exportToJson(since = 'daily', language = '', capturedAt) {
  const langKey = language || '';
  const langFileName = language ? language.toLowerCase() : 'all';

  // 1. 从数据库查询最新数据并格式化
  const latestData = getLatestTrending(since, langKey);
  
  if (!latestData || latestData.length === 0) {
    console.warn(`No data in DB to export for ${language || 'all'} (${since})`);
    return;
  }

  const output = {
    count: latestData.length,
    since: since,
    captured_at: capturedAt,
    data: latestData.map(item => {
      // 解析 AI 总结 (如果是 JSON 字符串)
      let aiSummary = null;
      if (item.aiSummary) {
        try {
          const content = JSON.parse(item.aiSummary);
          aiSummary = {
            ...content, // 展开 { zh: "...", en: "..." }
            source: item.aiSummaryProvider
          };
        } catch (e) {
          console.warn(`[Export] Failed to parse summary for ${item.repoName}`);
        }
      }

      return {
        rank: item.rank,
        author: item.author,
        repoName: item.repoName,
        url: item.url,
        description: item.description,
        language: item.language,
        languageColor: item.languageColor,
        stars: item.stars,
        forks: item.forks,
        currentPeriodStars: item.currentPeriodStars,
        builtBy: item.builtBy ? JSON.parse(item.builtBy) : [],
        aiSummary: aiSummary
      };
    })
  };

  const jsonContent = JSON.stringify(output, null, 2);

  // 2. 保存到 Latest API 目录: /api/trending/{since}/{lang}.json
  const latestDir = path.join('api', 'trending', since);
  await ensureDir(latestDir);
  const latestFile = path.join(latestDir, `${langFileName}.json`);
  await fs.writeFile(latestFile, jsonContent, 'utf-8');
  console.log(`[Export] Saved: ${latestFile}`);
}
