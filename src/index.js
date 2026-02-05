import { LANGUAGES, PERIODS } from './consts.js';
import { fetchTrending } from './scraper.js';
import { saveTrendingData } from './storage.js';

// 随机延迟函数
const randomDelay = (min = 2000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

async function main() {
  console.log('Starting GitHub Trending Crawler...');
  const startTime = Date.now();

  // 默认只抓取 daily，如果需要可以遍历 PERIODS
  // 考虑到 GitHub 限流，建议每次 Action 只跑一种 period 或者分批跑
  // 这里我们演示抓取 daily 的所有语言
  const since = 'daily';

  for (const lang of LANGUAGES) {
    try {
      const langName = lang || 'All Languages';
      console.log(`
--- Processing: ${langName} ---`);

      const repos = await fetchTrending(lang, since);

      if (repos.length > 0) {
        await saveTrendingData(repos, lang, since);
        console.log(`Success: ${repos.length} repos fetched.`);
      } else {
        console.warn(`Warning: 0 repos fetched for ${langName}`);
      }

      // 防反爬延迟
      const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
      console.log(`Waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error) {
      console.error(`Fatal error processing ${lang}:`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`
All tasks completed in ${duration}s`);
}

main().catch(err => { console.error(err.stack); });
