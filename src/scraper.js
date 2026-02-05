import axios from 'axios';
import * as cheerio from 'cheerio';
import { HEADERS } from './consts.js';

/**
 * 转换数字字符串为整数
 * @param {string} str - 例如 "1,234", "1.2k"
 * @returns {number}
 */
function parseNumber(str) {
  if (!str) return 0;
  str = str.trim().toLowerCase();
  if (str.endsWith('k')) {
    return Math.round(parseFloat(str.replace('k', '')) * 1000);
  }
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

/**
 * 抓取指定语言和周期的 GitHub Trending
 * @param {string} language
 * @param {string} since - 'daily', 'weekly', 'monthly'
 */
export async function fetchTrending(language = '', since = 'daily') {
  const url = `https://github.com/trending/${encodeURIComponent(language)}?since=${since}`;
  console.log(`Fetching: ${url}`);

  try {
    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);
    const repos = [];

    $('.Box-row').each((index, element) => {
      const $el = $(element);
      
      // 1. Repo Name & Link
      const titleTag = $el.find('h2 a');
      const relativeUrl = titleTag.attr('href');
      const fullName = relativeUrl ? relativeUrl.slice(1) : ''; // remove leading '/'
      const [author, name] = fullName.split('/');

      // 2. Description
      const description = $el.find('p').text().trim();

      // 3. Language
      const languageText = $el.find('[itemprop="programmingLanguage"]').text().trim() || 'Unknown';
      // 尝试获取语言颜色
      const langColorStyle = $el.find('.repo-language-color').attr('style');
      const languageColor = langColorStyle ? langColorStyle.match(/background-color:\s*(#[0-9a-fA-F]+)/i)?.[1] : null;

      // 4. Stats (Stars, Forks)
      // 这些数据都在 div.f6 里面
      const $statsDiv = $el.find('div.f6');
      const starsStr = $statsDiv.find('a[href$="/stargazers"]').text().trim();
      const forksStr = $statsDiv.find('a[href$="/forks"]').text().trim();

      // 5. Current Period Stars (e.g., "100 stars today")
      // 这里的文本可能包含 "stars today", "stars this week" 等
      const periodStarsText = $statsDiv.text();
      // 匹配形如 "123 stars today" 或 "1,234 stars this week"
      const periodMatch = periodStarsText.match(/(\d+,?\d*)\s+stars\s+(today|this week|this month)/i);
      const currentPeriodStars = periodMatch ? parseNumber(periodMatch[1]) : 0;

      // 6. Contributors
      const builtBy = [];
      $statsDiv.find('span:contains("Built by")').find('a').each((i, a) => {
          const $a = $(a);
          const avatarUrl = $a.find('img').attr('src');
          const username = $a.attr('href').slice(1); // remove leading '/'
          if (username && avatarUrl) {
              builtBy.push({ username, avatar: avatarUrl });
          }
      });

      repos.push({
        rank: index + 1,
        author,
        repoName: name,
        url: `https://github.com/${fullName}`,
        description,
        language: languageText,
        languageColor,
        stars: parseNumber(starsStr),
        forks: parseNumber(forksStr),
        currentPeriodStars,
        builtBy,
        // 添加元数据
        since, 
        fetchedAt: new Date().toISOString()
      });
    });

    return repos;
  } catch (error) {
    console.error(`Error fetching ${language || 'all'} (${since}):`, error.message);
    // 返回空数组而不是抛出错误，以便后续流程继续
    return [];
  }
}
