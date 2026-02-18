export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 1. 标准化参数
    const lang = url.searchParams.get('lang') || 'all';     // 编程语言
    const since = url.searchParams.get('since') || 'daily'; // 时间跨度
    
    // 增强 limit 解析
    const rawLimit = parseInt(url.searchParams.get('limit') || '25', 10);
    const limit = isNaN(rawLimit) || rawLimit <= 0 ? 25 : Math.min(rawLimit, 100);

    // 2. 增强参数
    const providerParam = url.searchParams.get('provider'); // AI 提供商 (支持多选: chatgpt,deepseek)
    const summaryLang = url.searchParams.get('summary_lang') || 'en'; // AI 总结输出语言，默认 en
    const date = url.searchParams.get('date');
    const batch = url.searchParams.get('batch');

    const providers = providerParam ? providerParam.split(',').map(p => p.trim()) : [];

    try {
        // --- 阶段一：定位时间锚点 ---
        let timeQuery = /* language=SQLite */ `SELECT captured_at FROM snapshots WHERE since = ? AND language_scope = ?`;
        const timeParams = [since, lang];

        if (date) {
            timeQuery += ` AND date(captured_at) = ?`;
            timeParams.push(date);
        }

        if (batch === 'am') {
            timeQuery += ` AND strftime('%H', captured_at) < '12'`;
        } else if (batch === 'pm') {
            timeQuery += ` AND strftime('%H', captured_at) >= '12'`;
        }

        timeQuery += ` ORDER BY captured_at DESC LIMIT 1`;

        const timeRecord = await env.DB.prepare(timeQuery).bind(...timeParams).first();

        if (!timeRecord) {
            return Response.json({
                success: true,
                count: 0,
                message: "No trending data found for the specified criteria",
                data: []
            });
        }

        const targetTime = timeRecord.captured_at;

        // --- 阶段二：查询数据 ---
        // 构造 provider 的 IN 子句
        const providerPlaceholder = providers.length > 0 
            ? `AND provider IN (${providers.map(() => '?').join(',')})` 
            : '';

        let dataQuery = /* language=SQLite */ `
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
                    ${providerPlaceholder}
                ) as aiSummaries
            FROM snapshots s
            JOIN repos r ON s.full_name = r.full_name
            WHERE s.since = ? AND s.language_scope = ? AND s.captured_at = ?
            ORDER BY s.rank ASC
            LIMIT ?
        `;

        // 绑定参数
        const dataParams = [
            ...providers,
            since, 
            lang, 
            targetTime,
            limit
        ];

        const { results } = await env.DB.prepare(dataQuery).bind(...dataParams).all();

        // --- 阶段三：格式化输出 ---
        const formattedData = results.map(item => {
            let summaries = [];
            if (item.aiSummaries) {
                try {
                    const raw = JSON.parse(item.aiSummaries);
                    summaries = raw.map(s => ({
                        provider: s.provider,
                        content: s.translations[summaryLang] || null
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
                aiSummaries: summaries.length > 0 ? summaries : null
            };
        });

        return Response.json({
            success: true,
            count: formattedData.length,
            metadata: {
                since,
                lang,
                summary_lang: summaryLang,
                providers: providers.length > 0 ? providers : ['all'],
                date: date || targetTime.split(' ')[0],
                batch: batch || (new Date(targetTime + 'Z').getUTCHours() < 12 ? 'am' : 'pm'),
                captured_at: targetTime
            },
            data: formattedData
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=1800'
            }
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
