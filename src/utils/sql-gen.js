/**
 * 安全地转义 SQL 字符串
 */
function escapeSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
}

/**
 * 将仓库数据转换为 INSERT OR REPLACE 语句
 */
export function generateRepoSql(repo) {
    const fullName = `${repo.author}/${repo.repoName}`;
    return `INSERT INTO repos (full_name, author, repo_name, url, description, language, language_color)
VALUES (${escapeSql(fullName)}, ${escapeSql(repo.author)}, ${escapeSql(repo.repoName)}, ${escapeSql(repo.url)}, ${escapeSql(repo.description)}, ${escapeSql(repo.language)}, ${escapeSql(repo.languageColor)})
ON CONFLICT(full_name) DO UPDATE SET
  description = excluded.description,
  language = excluded.language,
  language_color = excluded.language_color;`;
}

/**
 * 将快照数据转换为 INSERT 语句
 */
export function generateSnapshotSql(fullName, since, languageScope, repo, capturedAt) {
    const builtBy = repo.builtBy ? JSON.stringify(repo.builtBy) : null;
    return `INSERT INTO snapshots (full_name, since, language_scope, rank, stars, forks, current_period_stars, built_by, captured_at)
VALUES (${escapeSql(fullName)}, ${escapeSql(since)}, ${escapeSql(languageScope || 'all')}, ${repo.rank}, ${repo.stars}, ${repo.forks}, ${repo.currentPeriodStars}, ${escapeSql(builtBy)}, ${escapeSql(capturedAt)});`;
}

/**
 * 将 AI 总结转换为 INSERT OR REPLACE 语句
 */
export function generateAISummarySql(fullName, summary, provider) {
    // summary 通常已经是 JSON 字符串，或者是对象
    const summaryStr = typeof summary === 'string' ? summary : JSON.stringify(summary);
    return `INSERT INTO ai_summaries (full_name, summary, provider)
VALUES (${escapeSql(fullName)}, ${escapeSql(summaryStr)}, ${escapeSql(provider)})
ON CONFLICT(full_name, provider) DO UPDATE SET summary = excluded.summary;`;
}
