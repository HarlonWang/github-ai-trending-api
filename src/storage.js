import fs from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';
import { upsertRepo, insertSnapshot, getLatestTrending, runTransaction } from './db.js';

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
 * 保存数据到数据库并导出为 API 所需的 JSON 文件
 * @param {Array} repos - 仓库数据列表
 * @param {string} language - 语言名称
 * @param {string} since - 时间周期
 */
export async function saveTrendingData(repos, language = '', since = 'daily') {
  if (!repos || repos.length === 0) {
    console.warn(`No data to save for ${language || 'all'} (${since})`);
    return;
  }

  const langKey = language || '';
  const langFileName = language ? language.toLowerCase() : 'all';
  const now = dayjs();
  const capturedAt = now.format('YYYY-MM-DD HH:mm:ss');

  // 1. 数据落库 (使用事务确保原子性和性能)
  runTransaction(() => {
    for (const repo of repos) {
      const fullName = upsertRepo(repo);
      insertSnapshot(fullName, since, langKey, repo, capturedAt);
    }
  });

  // 2. 从数据库查询最新数据并格式化
  // 这样做可以确保 JSON 中的数据是经过数据库整理（如包含 AI 总结）后的统一版本
  const latestData = getLatestTrending(since, langKey);
  
  const output = {
    count: latestData.length,
    captured_at: capturedAt,
    // 将数据库字段映射回 API 字段
    data: latestData.map(item => ({
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
      aiSummary: item.aiSummaryContent ? {
        content: item.aiSummaryContent,
        source: item.aiSummaryProvider
      } : null
    }))
  };

  const jsonContent = JSON.stringify(output, null, 2);

  // 3. 保存到 Latest API 目录: /api/trending/{since}/{lang}.json
  const latestDir = path.join('api', 'trending', since);
  await ensureDir(latestDir);
  const latestFile = path.join(latestDir, `${langFileName}.json`);
  await fs.writeFile(latestFile, jsonContent, 'utf-8');
  console.log(`Saved latest: ${latestFile}`);
}
