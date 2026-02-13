# GitHub AI Trending API

每日定时从 GitHub Trending 抓取热门项目信息，并生成 AI 技术总结，通过 JSON API 形式对外提供数据。

## 功能特性

- 🤖 **AI 驱动**：利用 Google Gemini / DeepSeek 等 AI 模型为热门项目生成简洁的中文摘要。
- 🕒 **定时更新**：每日通过 GitHub Actions 自动运行，保持数据新鲜。
- 🚀 **零成本托管**：利用 GitHub 基础设施实现抓取、处理与存储。

## API 接入指南

您可以通过以下路径直接获取 JSON 格式的趋势数据：

### 基础 URL
`https://raw.githubusercontent.com/HarlonWang/github-ai-trending-api/main/api/trending/`

### 路径规则
`/{period}/{language}.json`

- **period (周期)**: `daily` (每日), `weekly` (每周), `monthly` (每月)
- **language (语言)**: `all` (所有语言汇总) 或特定语言的小写名称 (如 `javascript`, `python`, `kotlin`)

### 请求示例

- 全语言 daily：
    - https://raw.githubusercontent.com/HarlonWang/github-ai-trending-api/main/api/trending/daily/all.json
- JavaScript weekly：
    - https://raw.githubusercontent.com/HarlonWang/github-ai-trending-api/main/api/trending/weekly/javascript.json
- Kotlin monthly：
    - https://raw.githubusercontent.com/HarlonWang/github-ai-trending-api/main/api/trending/monthly/kotlin.json



---

## AI 增强特性 (AI-Powered Summaries) 🌟

本项目针对全语种榜单额外提供了 `aiSummary` 字段。

- **功能描述**：由 AI 自动提炼 50-80 字的中文技术摘要，重点突出核心价值与创新点。
- **数据示例**：

```json
{
  "count": 25,
  "captured_at": "2026-02-13 07:24:12",
  "data": [
    {
      "rank": 1,
      "author": "tambo-ai",
      "repoName": "tambo",
      "url": "https://github.com/tambo-ai/tambo",
      "description": "Generative UI SDK for React",
      "language": "TypeScript",
      "languageColor": "#3178c6",
      "stars": 9212,
      "forks": 441,
      "currentPeriodStars": 300,
      "builtBy": [
        {
          "username": "alecf",
          "avatar": "https://avatars.githubusercontent.com/u/135340?s=40&v=4"
        }
      ],
      "aiSummary": {
        "content": "Tambo 是一个基于 TypeScript 的 React 生成式 UI SDK，旨在简化 AI 驱动的交互界面开发。它通过声明式 API 将 AI 模型响应自动转换为动态 UI 组件，提升了开发效率。",
        "source": "deepseek"
      }
    }
  ]
}
```

---

## jsDelivr CDN 方式（可选）

URL ：https://cdn.jsdelivr.net/gh/HarlonWang/github-ai-trending-api@main/api/trending/{since}/{lang}.json
