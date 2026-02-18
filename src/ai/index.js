import { execSync } from 'node:child_process';
import { AI_CONFIG } from '../consts.js';

// 统一索引：存储格式为 "full_name:provider"
// 它既包含数据库里已有的，也包含本次运行刚刚生成的
let aiIndex = null;

/**
 * 初始化索引：从 D1 获取现有总结列表
 */
function initAIIndex() {
    if (aiIndex !== null) return;

    aiIndex = new Set();
    try {
        console.log('[AI] Loading existing summaries index from Cloudflare D1...');
        const output = execSync('npx wrangler d1 execute trending --remote --command="SELECT full_name, provider FROM ai_summaries" --json', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const data = JSON.parse(output);
        // wrangler 返回的可能是数组（如果有多条命令），取第一个结果
        const result = Array.isArray(data) ? data[0] : data;
        const rows = result?.results || [];

        rows.forEach(row => aiIndex.add(`${row.full_name}:${row.provider}`));
        console.log(`[AI] Loaded ${aiIndex.size} existing summary keys.`);
    } catch (e) {

        console.warn('[AI] Could not reach D1 to fetch index:', e.message);
        if (e.stderr) console.error('[AI] Wrangler Error:', e.stderr.toString());
        // 即使失败也标记为已初始化，避免重复尝试
        if (aiIndex === null) aiIndex = new Set();
    }
}

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
 * 针对指定 provider 获取总结
 * @returns {Object|null} { provider, summary }
 */
async function fetchSingleAISummary(repo, providerName, prompt) {
  try {
    const rawContent = await callProvider(providerName, prompt);
    if (!rawContent) return null;

    let parsedObj = null;
    try {
      parsedObj = JSON.parse(rawContent.trim());
    } catch (e) {
      console.error(`[AI] JSON Parse Error for ${repo.repoName} via ${providerName}: ${e.message}`);
      return null;
    }

    if (parsedObj) {
      console.log(`[AI] Successfully generated summary via ${providerName} for ${repo.repoName}`);
      return {
        provider: providerName,
        summary: JSON.stringify(parsedObj)
      };
    }
  } catch (error) {
    console.warn(`[AI] ${providerName} failed for ${repo.repoName}: ${error.message}`);
  }
  return null;
}

/**
 * 批量为仓库生成 AI 总结
 * @param {Array} repos - 仓库列表
 * @returns {Promise<Array>} 返回产生的总结结果对象数组的 Promise
 */
export async function generateAISummaries(repos) {
  // 初始化索引
  initAIIndex();

  console.log(`[AI] Processing ${repos.length} repositories...`);
  const results = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const fullName = `${repo.author}/${repo.repoName}`;

    // 找出该仓库真正缺失的 providers
    const providersToCall = AI_CONFIG.providers.filter(p => !aiIndex.has(`${fullName}:${p}`));

    if (providersToCall.length === 0) {
        continue;
    }

    console.log(`[AI] ${fullName} missing summaries from: ${providersToCall.join(', ')}`);

    const prompt = AI_CONFIG.promptTemplate
      .replace('{{name}}', fullName)
      .replace('{{url}}', repo.url)
      .replace('{{lang}}', repo.language || 'Unknown')
      .replace('{{desc}}', repo.description || 'No description');

    const summaries = await Promise.allSettled(
      providersToCall.map(p => fetchSingleAISummary(repo, p, prompt))
    );

    const repoSummaries = [];
    for (const res of summaries) {
        if (res.status === 'fulfilled' && res.value) {
            repoSummaries.push(res.value);
            // 立即更新索引，防止本次运行后续周期重复处理
            aiIndex.add(`${fullName}:${res.value.provider}`);
        }
    }

    if (repoSummaries.length > 0) {
        results.push({
            fullName,
            summaries: repoSummaries
        });
    }

    // 只有在真正请求了 AI 后才进行延迟
    if (i < repos.length - 1 && repoSummaries.length > 0) {
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.delay));
    }
  }
  return results;
}
