import { AI_CONFIG } from '../consts.js';
import * as gemini from './providers/gemini.js';
import * as deepseek from './providers/deepseek.js';
import { getCachedAISummary, saveAISummary } from '../db.js';

const providers = { gemini, deepseek };

/**
 * 核心调用逻辑：针对特定 provider 进行单次调用
 */
async function callProvider(providerName, prompt) {
  const provider = providers[providerName];
  const config = AI_CONFIG.providerConfig[providerName];

  if (!provider) {
    throw new Error(`Provider ${providerName} not found`);
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_CONFIG.timeout)
  );

  return await Promise.race([
    provider.generateSummary(prompt, config),
    timeoutPromise
  ]);
}

/**
 * 通过 AI Provider 获取总结并保存到数据库（支持多级兜底）
 */
async function fetchAndSaveAISummary(repo) {
  const fullName = `${repo.author}/${repo.repoName}`;
  const prompt = AI_CONFIG.promptTemplate
    .replace('{{name}}', fullName)
    .replace('{{lang}}', repo.language || 'Unknown')
    .replace('{{desc}}', repo.description || 'No description');

  // 构建调用链
  const providerChain = [
    AI_CONFIG.provider,
    ...(AI_CONFIG.fallbacks || [])
  ];

  for (const providerName of providerChain) {
    try {
      const rawContent = await callProvider(providerName, prompt);
      if (rawContent) {
        let parsedObj = null;
        try {
          parsedObj = JSON.parse(rawContent.trim());
        } catch (e) {
          console.error(`[AI] JSON Parse Error for ${repo.repoName}: ${e.message}`);
          console.error(`[AI] Raw content: ${rawContent}`);
        }

        if (parsedObj) {
          // 存入缓存 (序列化存储)
          const jsonString = JSON.stringify(parsedObj);
          saveAISummary(fullName, jsonString, providerName);
          return; // 成功后立即退出
        }
      }
    } catch (error) {
      console.warn(`[AI] ${providerName} failed for ${repo.repoName}: ${error.message}`);
    }
  }

  console.error(`[AI] All providers failed for ${repo.repoName}`);
}

/**
 * 批量确保仓库有 AI 总结（如果缓存没有则生成并保存到 DB）
 */
export async function generateAISummaries(repos) {
  console.log(`[AI] Processing ${repos.length} repositories...`);

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const fullName = `${repo.author}/${repo.repoName}`;

    // 检查缓存
    const cached = getCachedAISummary(fullName);
    if (cached && cached.summary) {
      console.log(`[AI] Skip (Cache Hit): ${fullName}`);
      continue;
    }

    // 缓存未命中，调用 AI 生成并保存
    await fetchAndSaveAISummary(repo);

    // 只有在真正请求了 AI 后才进行延迟
    if (i < repos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }
}
