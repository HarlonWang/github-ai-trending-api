import dayjs from 'dayjs';
import { LANGUAGES, PERIODS, AI_CONFIG } from './consts.js';
import { fetchTrending } from './scraper.js';
import { exportToJson } from './exporter.js';
import { generateAISummaries } from './ai/index.js';
import { initDB, upsertRepo, insertSnapshot, runTransaction } from './db.js';

async function main() {
    console.log('Starting GitHub Trending Crawler with SQLite...');
    initDB();
    const startTime = Date.now();

    // 遍历 PERIODS 与 LANGUAGES
    for (const since of PERIODS) {
        console.log(`\n=== Period: ${since} ===`);

        for (const lang of LANGUAGES) {
            try {
                const langName = lang || 'All Languages';
                console.log(`\n--- Processing: ${langName} ---`);

                // 1. 抓取 (Fetch)
                const repos = await fetchTrending(lang, since);

                if (repos.length > 0) {
                    const capturedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');

                    // 2. 仓库信息写入 DB
                    runTransaction(() => {
                        for (const repo of repos) {
                            upsertRepo(repo);
                        }
                    });

                    // 3. AI 摘要总结
                    const shouldRunAI = AI_CONFIG.enabled &&
                                       AI_CONFIG.filters.languages.includes(lang) &&
                                       AI_CONFIG.filters.periods.includes(since);

                    if (shouldRunAI) {
                        try {
                            await generateAISummaries(repos);
                        } catch (aiError) {
                            console.error(`[AI] Error processing summaries for ${lang || 'All'}:`, aiError.message);
                        }
                    }

                    // 4. 记录快照 (Record Snapshots)
                    runTransaction(() => {
                        for (const repo of repos) {
                            const fullName = `${repo.author}/${repo.repoName}`;
                            insertSnapshot(fullName, since, lang, repo, capturedAt);
                        }
                    });

                    // 5. 导出 API (Export JSON)
                    await exportToJson(since, lang, capturedAt);

                    console.log(`Success: ${repos.length} repos processed.`);
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
    console.log(`\nAll tasks completed in ${duration}s`);
}

main().catch(err => { console.error(err.stack); });
