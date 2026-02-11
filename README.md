# GitHub AI Trending API

每日定时从 GitHub Trending 抓取热门项目信息，并生成 AI 技术总结，通过 JSON API 形式对外提供数据。

## 功能特性

- 🤖 **AI 驱动**：利用 Google Gemini 等 AI 模型为热门项目生成简洁的中文摘要。
- 🕒 **定时更新**：每日通过 GitHub Actions 自动运行，保持数据新鲜。
- 📦 **自动存档**：支持按日期存档历史趋势数据。
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

本项目针对 **`daily/all.json`** (全语种日报) 榜单额外提供了 `aiSummary` 字段。

- **功能描述**：由 Gemini 自动提炼 50-80 字的中文技术摘要，重点突出核心价值与创新点。
- **数据示例**：

```json
[
  {
    "rank": 1,
    "author": "bytedance",
    "repoName": "UI-TARS",
    "url": "https://github.com/bytedance/UI-TARS",
    "description": "A GUI agent model based on VLM.",
    "aiSummary": "该项目是一个基于多模态大模型的GUI智能体，通过视觉感知实现对任意操作系统的端到端操控。其核心价值在于仅凭屏幕图像即可完成任务，无需依赖底层元数据，适用于自动化办公、软件测试等多种复杂交互场景。",
    "language": "Python",
    "stars": 12500,
    "currentPeriodStars": 450
  }
]
```

---

## 历史归档 (Archive)

历史数据存储在 `/archives` 目录下，路径格式为：
`/archives/YYYY-MM-DD/{period}/{language}.json`

## jsDelivr CDN 方式（可选）

URL ：https://cdn.jsdelivr.net/gh/HarlonWang/github-ai-trending-api@main/api/trending/{since}/{lang}.json
