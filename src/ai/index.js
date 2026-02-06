import { AI_CONFIG } from '../consts.js';
import * as gemini from './providers/gemini.js';

const providers = { gemini };

/**
 * 为单个仓库生成总结（带超时和重试逻辑）
 */
async function getSummaryWithRetry(repo, retryCount = 0) {
  const providerName = AI_CONFIG.provider;
  const provider = providers[providerName];
  const config = AI_CONFIG.providerConfig[providerName];

  if (!provider) {
    console.warn(`[AI] Provider ${providerName} not found.`);
    return null;
  }

  // 1. 模板替换
  const prompt = AI_CONFIG.promptTemplate
    .replace('{{name}}', `${repo.author}/${repo.repoName}`)
    .replace('{{lang}}', repo.language || 'Unknown')
    .replace('{{desc}}', repo.description || 'No description');

  // 2. 超时包装
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_CONFIG.timeout)
  );

  try {
    return await Promise.race([
      provider.generateSummary(prompt, config),
      timeoutPromise
    ]);
  } catch (error) {
    if (retryCount < AI_CONFIG.maxRetries) {
      console.log(`[AI] Retrying ${repo.repoName}... (${retryCount + 1})`);
      return getSummaryWithRetry(repo, retryCount + 1);
    }
    console.warn(`[AI] Failed for ${repo.repoName}: ${error.message}`);
    return null;
  }
}

/**
 * 批量为仓库注入 AI 总结
 * @param {Array} repos 
 * @param {string} language 
 * @param {string} since 
 */
export async function injectAISummaries(repos, language, since) {
  const isEnabled = AI_CONFIG.enabled;
  const langMatch = AI_CONFIG.filters.languages.includes(language);
  const periodMatch = AI_CONFIG.filters.periods.includes(since);

  if (!isEnabled || !langMatch || !periodMatch) {
    if (isEnabled && language === '' && since === 'daily') {
       // 如果是 all daily 却没匹配上（理论上不会，除非配置改了），可以记录日志
    }
    return repos;
  }

  console.log(`[AI] Summarizing ${repos.length} repositories for ${language || 'All Languages'} (${since})...`);
  
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    repo.aiSummary = await getSummaryWithRetry(repo);
    
    if (i < repos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }

  return repos;
}
