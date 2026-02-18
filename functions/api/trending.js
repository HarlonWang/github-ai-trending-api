export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 获取查询参数
    const lang = url.searchParams.get('lang') || 'all';
    const since = url.searchParams.get('since') || 'daily';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);

    try {
        // 1. 查找最近一次抓取的时间点
        const lastCapture = await env.DB.prepare(`
            SELECT MAX(captured_at) as last_time 
            FROM snapshots 
            WHERE since = ? AND language_scope = ?
        `).bind(since, lang).first();

        if (!lastCapture || !lastCapture.last_time) {
            return Response.json({
                count: 0,
                since,
                data: []
            });
        }

        // 2. 查询最新数据，并聚合 AI 总结
        const { results } = await env.DB.prepare(`
            SELECT 
                s.rank, r.author, r.repo_name as repoName, r.url, r.description, 
                r.language, r.language_color as languageColor, s.stars, s.forks, 
                s.current_period_stars as currentPeriodStars, s.built_by as builtBy,
                (
                    SELECT json_group_array(
                        json_object('provider', provider, 'translations', json(summary))
                    )
                    FROM ai_summaries
                    WHERE full_name = r.full_name
                ) as aiSummaries
            FROM snapshots s
            JOIN repos r ON s.full_name = r.full_name
            WHERE s.since = ? AND s.language_scope = ? AND s.captured_at = ?
            ORDER BY s.rank ASC
            LIMIT ?
        `).bind(since, lang, lastCapture.last_time, limit).all();

        // 3. 格式化输出 (保持与旧 JSON 兼容)
        const formattedData = results.map(item => {
            let aiSummaries = null;
            if (item.aiSummaries) {
                try {
                    const rawSummaries = JSON.parse(item.aiSummaries);
                    aiSummaries = rawSummaries.map(s => ({
                        provider: s.provider,
                        ...s.translations
                    }));
                } catch (e) {}
            }

            return {
                rank: item.rank,
                author: item.author,
                repoName: item.repoName,
                url: item.url,
                description: item.description,
                language: item.language,
                languageColor: item.languageColor,
                stars: item.stars,
                forks: item.forks,
                currentPeriodStars: item.currentPeriodStars,
                builtBy: item.builtBy ? JSON.parse(item.builtBy) : [],
                aiSummaries: aiSummaries && aiSummaries.length > 0 ? aiSummaries : null
            };
        });

        return Response.json({
            count: formattedData.length,
            since: since,
            captured_at: lastCapture.last_time,
            data: formattedData
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (err) {
        return Response.json({
            error: err.message
        }, { status: 500 });
    }
}
