# GitHub AI Trending API

每日定时从 GitHub Trending 抓取热门项目信息，并利用 AI 模型生成技术总结。

## 功能特性

- 🤖 **AI 驱动**：利用 Google Gemini / DeepSeek 等 AI 模型为热门项目生成简洁的中文摘要。
- 🕒 **定时更新**：每日通过 GitHub Actions 自动运行，保持数据新鲜。
- 🚀 **零成本托管**：利用 GitHub 基础设施实现抓取、处理与存储。

## 📖 API 使用文档

**接口地址**: `https://api.trendingai.cn/api/trending`

### 请求参数

| 参数 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `lang` | string | 编程语言过滤，缺省为 `all` | `python`, `rust`, `javascript` |
| `since` | string | 趋势周期，支持 `daily` (默认), `weekly`, `monthly` | `weekly` |
| `limit` | number | 返回数量限制 (1-100)，默认 `25` | `50` |
| `provider` | string | AI 提供商过滤，支持多选（逗号分隔） | `deepseek` 或 `chatgpt,deepseek` |
| `summary_lang`| string | AI 摘要输出语言，支持 `zh`, `en` (默认) | `zh` |
| `date` | string | 查询历史特定日期，格式 `YYYY-MM-DD` | `2026-02-17` |
| `batch` | string | 查询特定抓取批次，支持 `am`, `pm` | `am` (对应 UTC 00:17) |

### 快速示例

- **获取今日全语言榜单（默认英文总结）**:
  [https://api.trendingai.cn/api/trending](https://api.trendingai.cn/api/trending)
- **获取本周 Python 热门项目（带中文总结）**:
  [https://api.trendingai.cn/api/trending?lang=python&since=weekly&summary_lang=zh](https://api.trendingai.cn/api/trending?lang=python&since=weekly&summary_lang=zh)
- **获取特定日期的早报批次数据**:
  [https://api.trendingai.cn/api/trending?date=2026-02-17&batch=am](https://api.trendingai.cn/api/trending?date=2026-02-17&batch=am)

---
