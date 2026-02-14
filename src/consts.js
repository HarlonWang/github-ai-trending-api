export const LANGUAGES = [
  '', // All languages
  'python',
  'javascript',
  'java',
  'go',
  'rust',
  'typescript',
  'c++',
  'c',
  'swift',
  'kotlin',
];

export const PERIODS = ['daily', 'weekly', 'monthly'];

export const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://github.com/trending',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

export const AI_CONFIG = {
  enabled: process.env.AI_ENABLED === 'true',
  provider: 'deepseek',
  fallbacks: ['gemini'], // 按顺序尝试的备用提供者
  timeout: 30000,
  delay: 3000,

  // 仅在 language 为空 (All Languages) 且 since 为 daily 时触发
  filters: {
    languages: [''],
    periods: ['daily']
  },

  promptTemplate: `
你是一个专业的软件开发专家。请根据以下 GitHub 项目信息生成一段简洁的总结，要求同时提供中文和英文版本：

项目名称: {{name}}
主要语言: {{lang}}
项目描述: {{desc}}

要求：
1. 字数控制：中文 50-80 字之间，英文 20-40 词之间。
2. 重点描述该项目解决了什么痛点或实现了什么核心功能。
3. 语言风格专业且干练。
4. 必须以 JSON 格式输出，不要包含任何其他说明文字，格式如下：
{
  "zh": "中文总结内容",
  "en": "English summary content"
}
  `.trim(),

  providerConfig: {
    gemini: {
      model: 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
    },
    deepseek: {
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: 'https://api.deepseek.com/v1'
    }
  }
};
