import { LANGUAGES, PERIODS } from './consts.js';
import { fetchTrending } from './scraper.js';
import { saveTrendingData } from './storage.js';
import { injectAISummaries } from './ai/index.js';

async function main() {
    console.log('Starting GitHub Trending Crawler...');
    const startTime = Date.now();

    // 遍历 PERIODS 与 LANGUAGES
    // 考虑到 GitHub 限流，建议每次 Action 分批跑或只跑部分周期
    for (const since of PERIODS) {
        console.log(`
=== Period: ${since} ===`);

        for (const lang of LANGUAGES) {
            try {
                const langName = lang || 'All Languages';
                console.log(`
--- Processing: ${langName} ---`);

                const repos = await fetchTrending(lang, since);

                if (repos.length > 0) {
                    try {
                        await injectAISummaries(repos, lang, since);
                    } catch (aiError) {
                        console.error(`[AI] Error processing summaries for ${lang || 'All'}:`, aiError.message);
                    }
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
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`
All tasks completed in ${duration}s`);
}

main().catch(err => { console.error(err.stack); });
