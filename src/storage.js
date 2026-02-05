import fs from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';

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
 * 保存数据到文件
 * @param {Array} data - 仓库数据列表
 * @param {string} language - 语言名称
 * @param {string} since - 时间周期
 */
export async function saveTrendingData(data, language = '', since = 'daily') {
  if (!data || data.length === 0) {
    console.warn(`No data to save for ${language || 'all'} (${since})`);
    return;
  }

  const langFileName = language ? language.toLowerCase() : 'all';
  const jsonContent = JSON.stringify(data, null, 2);

  // 1. 保存到 Latest API 目录: /api/trending/{since}/{lang}.json
  const latestDir = path.join('api', 'trending', since);
  await ensureDir(latestDir);
  const latestFile = path.join(latestDir, `${langFileName}.json`);
  await fs.writeFile(latestFile, jsonContent, 'utf-8');
  console.log(`Saved latest: ${latestFile}`);

  // 2. 保存到 Archive 目录: /archives/{YYYY-MM-DD}/{since}/{lang}.json
  // 注意：只归档 daily 数据，或者根据需求归档所有。
  // 通常归档 daily 数据价值最大。
  const today = dayjs().format('YYYY-MM-DD');
  const archiveDir = path.join('archives', today, since);
  await ensureDir(archiveDir);
  const archiveFile = path.join(archiveDir, `${langFileName}.json`);
  await fs.writeFile(archiveFile, jsonContent, 'utf-8');
  console.log(`Saved archive: ${archiveFile}`);
}
