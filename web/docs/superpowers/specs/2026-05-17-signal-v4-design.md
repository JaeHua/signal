# Signal v4 设计规格

> 日期：2026-05-17
> 分支：develop

---

## 1. 版本目标

可观测仪表盘 + 分享卡片 + AI 定价配置。

---

## 2. 数据模型

### PipelineRun 扩展
```
totalDurationMs Int?      // 总耗时
totalTokens     Int?      // 总 token
avgLatencyMs    Int?      // 平均延迟
```

### DailyMetrics（新增）
按天聚合：date, source, totalRuns, successRuns, totalScraped, totalProcessed, totalErrors, totalTokens, totalDurationMs, estimatedCost

### AIConfig 扩展
```
inputPricePer1K   Float?  // $/1K tokens
outputPricePer1K  Float?  // $/1K tokens
```

---

## 3. 指标仪表盘 `/metrics`

- 顶部 4 卡片：今日处理数、成功率%、Token 消耗、估算成本
- 每日处理趋势折线图（按来源堆叠）
- 成功率与延迟双轴图
- 告警设置

---

## 4. 分享卡片

详情页「分享」按钮 → html-to-image 截图生成 2:1 比例分享图 → 可复制/下载

---

## 5. Settings AI 定价配置

input/output 价格字段
