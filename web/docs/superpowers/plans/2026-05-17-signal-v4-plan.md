# Signal v4 实现计划

**Goal:** 可观测仪表盘（charts + 延迟 + 成本）+ 分享卡片 + AI 定价配置

---

### Task 1: 数据模型 + Pipeline 记录延迟/token

**Files:** prisma/schema.prisma, src/pipeline/pipeline.ts

Schema changes:
- PipelineRun: +totalDurationMs Int?, +totalTokens Int?, +avgLatencyMs Int?
- AIConfig: +inputPricePer1K Float?, +outputPricePer1K Float?
- NEW DailyMetrics

Pipeline: record startTime, per-item duration, sum tokens from AI response.

---

### Task 2: DailyMetrics 聚合 + API

New `src/app/api/metrics/route.ts`:
- GET: return DailyMetrics for last 7/30 days
- Pipeline after each run: upsert DailyMetrics for that date+source

---

### Task 3: 指标页面 `/metrics`

`src/app/metrics/page.tsx`: recharts charts, stat cards, alert config section.

---

### Task 4: 分享卡片

- Install `html-to-image`
- `src/components/share-card.tsx`: Capture SignalCard → PNG download/copy
- Add share button to `src/app/signals/[id]/page.tsx`

---

### Task 5: Settings AI 定价

Update `src/app/settings/page.tsx` and `src/app/api/settings/ai/route.ts`: add input/output price fields.

---

### Task 6: 安装 recharts + html-to-image + commit

```bash
npm install recharts html-to-image
```
