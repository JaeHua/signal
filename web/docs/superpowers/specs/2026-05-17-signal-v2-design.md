# Signal v2 设计规格

> 日期：2026-05-17
> 分支：develop
> 状态：设计完成，进入实现

---

## 1. 版本目标

在 v1 MVP 基础上扩展多信息源、用户配置、运行日志和 UI 打磨。

**新增功能：**

1. **Hacker News 信息源** — 接入 HN front page，SourceProvider 泛化预留后续扩展
2. **配置页面** — `/settings`：AI 模型切换 + 信息源开关/数量/频率
3. **日志与归档页面** — `/history`：Pipeline 运行日志 + 按日浏览历史内容
4. **UI 优化** — Dashboard Tab 切换来源、源徽标、细节打磨

---

## 2. 数据模型

### Signal（通用信息条目，替代 Repo）

```
Signal:
  id, source("github"|"hackernews"), sourceId(@unique)
  title, url, description?, metadata(JSON)?
  publishedAt?, trendingDate?, trendingRank?
  summaries[], savedBy[]
```

metadata JSON 示例：
- GitHub: `{"stars":1200,"forks":89,"language":"Rust"}`
- HN: `{"score":342,"comments":89,"author":"pg"}`
- 微博: `{"reposts":5000,"likes":12000}`
- 股票: `{"symbol":"AAPL","price":189.50,"change":"+2.3%"}`

### PipelineRun（运行日志）

```
PipelineRun:
  id, source, status("success"|"partial"|"failed")
  scraped, processed, skipped, errors
  errorLog(JSON)?
  startedAt, finishedAt?
```

### SourceConfig（信息源配置）

```
SourceConfig:
  key(@unique), enabled(bool), maxItems(int), frequency(str)
  config(JSON)?
```

### AIConfig（AI模型配置）

```
AIConfig:
  provider, model, apiKey(加密), baseUrl?, isActive(bool)
```

---

## 3. SourceProvider 泛化

```typescript
interface SignalItem {
  source: string
  sourceId: string
  title: string
  url: string
  description: string | null
  publishedAt: string | null
  metadata: Record<string, unknown>
  rank: number
}

interface SourceProvider {
  name: string
  fetchItems(maxItems: number): Promise<SignalItem[]>
}
```

### Hacker News 实现

使用 HN Firebase API：`GET /v0/topstories.json` → 取前 N → `GET /v0/item/{id}.json`

---

## 4. 页面

| 路由 | 页面 | 变更 |
|------|------|------|
| `/` | Dashboard | Tab 切换来源，source 徽标 |
| `/signals/[id]` | 详情 | 路径改名，适配 Signal 模型 |
| `/saved` | 收藏 | 适配 Signal |
| `/settings` | 新增 | AI + 信息源配置 |
| `/history` | 新增 | 运行日志 + 归档 |

### Settings 页面
- AI 配置区：选择 Provider、模型、填 API Key、Base URL
- 信息源配置区：开关、数量、频率

### History 页面
- 上方：运行日志列表（来源、状态、数量、时间）
- 下方：每日归档（日期选择器 + Signal 卡片网格）

### UI 优化
- Dashboard Tab：`[全部] [GitHub] [Hacker News]`
- 卡片右上角 source 徽标
- Hover 微动效、间距微调

---

## 5. API Routes

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/signals?source=&limit=` | 取代 `/api/trending` |
| GET | `/api/signals/[id]` | 取代 `/api/repo/[id]` |
| POST | `/api/signals/refresh` | 取代 `/api/trending/refresh` |
| GET | `/api/history?date=&source=` | 新增，归档查询 |
| GET | `/api/pipeline-runs` | 新增，运行日志 |
| GET/POST | `/api/settings/sources` | 新增，信息源配置 |
| GET/POST | `/api/settings/ai` | 新增，AI配置 |
| GET/POST/DELETE | `/api/saved` | 适配 Signal |

---

## 6. Pipeline 变更

```
Scheduler → 读取 SourceConfig(enabled) →
  For each source:
    Pipeline → fetchItems → upsert Signal → AI process → PipelineRun
```

- AI provider 从 AIConfig active 行读取
- Scheduler 频率从 SourceConfig 读取
- 每来源独立记录 PipelineRun

---

## 7. 技术要点

- 数据迁移：`Repo` → `Signal`，需要迁移脚本
- 文件重命名：`repo-card.tsx` → `signal-card.tsx`，路由 `repo/[id]` → `signals/[id]`
- API Key 存储：简单 AES 加密或 base64（非明文），浏览器传回时脱敏显示
- 向后兼容：旧 API 路径保留 301 重定向到新路径
