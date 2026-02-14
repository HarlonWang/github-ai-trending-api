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
 * 验证并解析 AI 返回的 JSON
 */
function parseAIResponse(content, repoName) {
  try {
    // 即使开启了 Native JSON，某些情况下模型仍可能返回带 Markdown 代码块的内容
    // 简单的去除 Markdown 标记以提高解析成功率
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (e) {
    console.error(`[AI] JSON Parse Error for ${repoName}: ${e.message}`);
    console.error(`[AI] Raw content: ${content}`);
    return null;
  }
}

/**
 * 为单个仓库生成总结（支持多级兜底）
 */
async function getSummaryWithFallback(repo) {
  const fullName = `${repo.author}/${repo.repoName}`;

  // 1. 检查缓存
  const cached = getCachedAISummary(fullName);
  if (cached && cached.summary) {
    console.log(`[AI] Cache Hit: ${fullName}`);
    return {
      summary: cached.summary, // 已经是 JSON 字符串
      source: `cache(${cached.provider})`
    };
  }

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
        const parsedObj = parseAIResponse(rawContent, repo.repoName);
        
        if (parsedObj) {
          // 2. 存入缓存 (序列化存储)
          const jsonString = JSON.stringify(parsedObj);
          saveAISummary(fullName, jsonString, providerName);
          
          return {
            summary: jsonString,
            source: providerName
          };
        }
      }
    } catch (error) {
      console.warn(`[AI] ${providerName} failed for ${repo.repoName}: ${error.message}`);
    }
  }

  console.error(`[AI] All providers failed for ${repo.repoName}`);
  return null;
}

/**
 * 批量为仓库注入 AI 总结
 */
export async function injectAISummaries(repos, language, since) {
  const isEnabled = AI_CONFIG.enabled;
  const langMatch = AI_CONFIG.filters.languages.includes(language);
  const periodMatch = AI_CONFIG.filters.periods.includes(since);

  if (!isEnabled || !langMatch || !periodMatch) {
    return repos;
  }

  console.log(`[AI] Summarizing ${repos.length} repositories for ${language || 'All Languages'} (${since})...`);
  
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const result = await getSummaryWithFallback(repo);
    
    if (result) {
      repo.aiSummary = result; // { summary: string, source: string }
    }
    
    if (i < repos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }

  return repos;
}
