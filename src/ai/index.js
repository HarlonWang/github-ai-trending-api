import { AI_CONFIG } from '../consts.js';
import { getCachedAISummaries, saveAISummary } from '../db.js';

/**
 * 核心调用逻辑：针对特定 provider 进行单次调用
 */
async function callProvider(providerName, prompt) {
  // 动态导入 Provider 模块
  let provider;
  try {
    provider = await import(`./providers/${providerName}.js`);
  } catch (e) {
    throw new Error(`AI Provider "${providerName}" 加载失败: ${e.message}`);
  }

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
 * 针对指定 provider 获取总结并保存
 */
async function fetchAndSaveSingleAISummary(repo, providerName, prompt) {
  try {
    const rawContent = await callProvider(providerName, prompt);
    if (!rawContent) return;

    let parsedObj = null;
    try {
      parsedObj = JSON.parse(rawContent.trim());
    } catch (e) {
      console.error(`[AI] JSON Parse Error for ${repo.repoName} via ${providerName}: ${e.message}`);
      return;
    }

    if (parsedObj) {
      const fullName = `${repo.author}/${repo.repoName}`;
      saveAISummary(fullName, JSON.stringify(parsedObj), providerName);
      console.log(`[AI] Successfully generated summary via ${providerName} for ${repo.repoName}`);
    }
  } catch (error) {
    console.warn(`[AI] ${providerName} failed for ${repo.repoName}: ${error.message}`);
  }
}

/**
 * 批量确保仓库有所有配置的 AI 总结（增量补齐）
 */
export async function generateAISummaries(repos) {
  console.log(`[AI] Processing ${repos.length} repositories for multiple providers...`);

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const fullName = `${repo.author}/${repo.repoName}`;
    const prompt = AI_CONFIG.promptTemplate
      .replace('{{name}}', fullName)
      .replace('{{url}}', repo.url)
      .replace('{{lang}}', repo.language || 'Unknown')
      .replace('{{desc}}', repo.description || 'No description');

    // 1. 检查已有的总结
    const existingSummaries = getCachedAISummaries(fullName);
    const existingProviders = existingSummaries.map(s => s.provider);

    // 2. 找出缺失的提供商
    const missingProviders = AI_CONFIG.providers.filter(p => !existingProviders.includes(p));

    if (missingProviders.length === 0) {
      console.log(`[AI] Skip (All Done): ${fullName}`);
      continue;
    }

    console.log(`[AI] ${fullName} missing summaries from: ${missingProviders.join(', ')}`);

    // 3. 并行调用缺失的提供商 (尽力而为)
    await Promise.allSettled(
      missingProviders.map(p => fetchAndSaveSingleAISummary(repo, p, prompt))
    );

    // 只有在真正请求了 AI 后才进行延迟
    if (i < repos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }
}
