import { AI_CONFIG } from '../consts.js';
import * as gemini from './providers/gemini.js';
import * as deepseek from './providers/deepseek.js';

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
 * 为单个仓库生成总结（支持多级兜底）
 */
async function getSummaryWithFallback(repo) {
  const prompt = AI_CONFIG.promptTemplate
    .replace('{{name}}', `${repo.author}/${repo.repoName}`)
    .replace('{{lang}}', repo.language || 'Unknown')
    .replace('{{desc}}', repo.description || 'No description');

  // 构建调用链：[主Provider, ...兜底Providers]
  const providerChain = [
    AI_CONFIG.provider,
    ...(AI_CONFIG.fallbacks || [])
  ];

  for (const providerName of providerChain) {
    try {
      const content = await callProvider(providerName, prompt);
      if (content) {
        return {
          content: content.trim(),
          source: providerName
        };
      }
    } catch (error) {
      console.warn(`[AI] ${providerName} failed for ${repo.repoName}: ${error.message}`);
      // 失败后立即切换到下一个 provider
    }
  }

  console.error(`[AI] All providers failed for ${repo.repoName}`);
  return null;
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
    repo.aiSummary = await getSummaryWithFallback(repo);
    
    if (i < repos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }

  return repos;
}
