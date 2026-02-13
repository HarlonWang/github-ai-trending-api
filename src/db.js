import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'data', 'trending.db');

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
// 启用 WAL 模式提高性能
db.pragma('journal_mode = WAL');

/**
 * 初始化表结构
 */
export function initDB() {
    db.exec(/* language=SQLite */ `
    -- 仓库基础信息表
    CREATE TABLE IF NOT EXISTS repos (
        full_name TEXT PRIMARY KEY,
        author TEXT,
        repo_name TEXT,
        url TEXT,
        description TEXT,
        language TEXT,
        language_color TEXT
    );

    -- AI 总结缓存表
    CREATE TABLE IF NOT EXISTS ai_summaries (
        full_name TEXT PRIMARY KEY,
        content TEXT,
        provider TEXT,
        FOREIGN KEY (full_name) REFERENCES repos (full_name)
    );

    -- 榜单快照表
    CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        since TEXT,
        language_scope TEXT,
        rank INTEGER,
        stars INTEGER,
        forks INTEGER,
        current_period_stars INTEGER,
        built_by TEXT,
        captured_at DATETIME,
        FOREIGN KEY (full_name) REFERENCES repos (full_name)
    );

    -- 创建索引优化查询
    CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON snapshots(captured_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON snapshots(since, language_scope, captured_at);
  `);
}

/**
 * 获取缓存的 AI 总结
 */
export function getCachedAISummary(fullName) {
    return db.prepare(/* language=SQLite */ 'SELECT content, provider FROM ai_summaries WHERE full_name = ?')
        .get(fullName);
}

/**
 * 保存 AI 总结到缓存
 */
export function saveAISummary(fullName, content, provider) {
    db.prepare(/* language=SQLite */ `
    INSERT OR REPLACE INTO ai_summaries (full_name, content, provider)
    VALUES (?, ?, ?)
  `).run(fullName, content, provider);
}

/**
 * 保存或更新仓库信息
 */
export function upsertRepo(repo) {
    const fullName = `${repo.author}/${repo.repoName}`;
    db.prepare(/* language=SQLite */ `
    INSERT INTO repos (full_name, author, repo_name, url, description, language, language_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(full_name) DO UPDATE SET
      description = excluded.description,
      language = excluded.language,
      language_color = excluded.language_color
  `).run(
        fullName,
        repo.author,
        repo.repoName,
        repo.url,
        repo.description,
        repo.language,
        repo.languageColor
    );
    return fullName;
}

/**
 * 记录榜单快照
 */
export function insertSnapshot(fullName, since, languageScope, repo, capturedAt) {
    db.prepare(/* language=SQLite */ `
    INSERT INTO snapshots (full_name, since, language_scope, rank, stars, forks, current_period_stars, built_by, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        fullName,
        since,
        languageScope || 'all',
        repo.rank,
        repo.stars,
        repo.forks,
        repo.currentPeriodStars,
        repo.builtBy ? JSON.stringify(repo.builtBy) : null,
        capturedAt
    );
}

/**
 * 运行数据库事务
 */
export const runTransaction = (fn) => db.transaction(fn)();

/**
 * 获取最新的榜单数据（用于导出 JSON）
 */
export function getLatestTrending(since, languageScope) {
    const scope = languageScope || 'all';
    // 找到最近一次抓取的时间点
    const lastCapture = db.prepare(/* language=SQLite */ `
    SELECT MAX(captured_at) as last_time 
    FROM snapshots 
    WHERE since = ? AND language_scope = ?
  `).get(since, scope);

    if (!lastCapture || !lastCapture.last_time) return [];

    return db.prepare(/* language=SQLite */ `
    SELECT 
      s.rank, r.author, r.repo_name as repoName, r.url, r.description, 
      r.language, r.language_color as languageColor, s.stars, s.forks, 
      s.current_period_stars as currentPeriodStars, s.built_by as builtBy,
      ai.content as aiSummaryContent, ai.provider as aiSummaryProvider
    FROM snapshots s
    JOIN repos r ON s.full_name = r.full_name
    LEFT JOIN ai_summaries ai ON r.full_name = ai.full_name
    WHERE s.since = ? AND s.language_scope = ? AND s.captured_at = ?
    ORDER BY s.rank
  `).all(since, scope, lastCapture.last_time);
}
