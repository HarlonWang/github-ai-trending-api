import dayjs from 'dayjs';
import fs from 'node:fs';
import { LANGUAGES, PERIODS, AI_CONFIG } from './consts.js';
import { fetchTrending } from './scraper.js';
import { generateAISummaries } from './ai/index.js';
import { generateRepoSql, generateSnapshotSql, generateAISummarySql } from './utils/sql-gen.js';

async function main() {
    console.log('Starting GitHub Trending Crawler for Cloudflare D1...');
    const startTime = Date.now();
    const sqlStatements = [];

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

                    // 2. 生成仓库 SQL
                    for (const repo of repos) {
                        sqlStatements.push(generateRepoSql(repo));
                    }

                    // 3. AI 摘要总结
                    const shouldRunAI = AI_CONFIG.enabled &&
                                       AI_CONFIG.filters.languages.includes(lang) &&
                                       AI_CONFIG.filters.periods.includes(since);

                    if (shouldRunAI) {
                        try {
                            const aiResults = await generateAISummaries(repos);
                            for (const res of aiResults) {
                                for (const s of res.summaries) {
                                    sqlStatements.push(generateAISummarySql(res.fullName, s.summary, s.provider));
                                }
                            }
                        } catch (aiError) {
                            console.error(`[AI] Error processing summaries for ${lang || 'All'}:`, aiError.message);
                        }
                    }

                    // 4. 生成快照 SQL
                    for (const repo of repos) {
                        const fullName = `${repo.author}/${repo.repoName}`;
                        sqlStatements.push(generateSnapshotSql(fullName, since, lang, repo, capturedAt));
                    }

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

    // 将所有 SQL 语句写入文件
    if (sqlStatements.length > 0) {
        fs.writeFileSync('sync.sql', sqlStatements.join('\n'));
        console.log(`\nSuccessfully generated sync.sql with ${sqlStatements.length} statements.`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nAll tasks completed in ${duration}s`);
}

main().catch(err => { console.error(err.stack); });
