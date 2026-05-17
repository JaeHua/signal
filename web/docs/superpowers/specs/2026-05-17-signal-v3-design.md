# Signal v3 设计规格

> 日期：2026-05-17
> 分支：develop
> 状态：设计完成，进入实现

---

## 1. 版本目标

v3 聚焦三大方向：移动端响应式适配、语义搜索增强、知识库向量化基础。

---

## 2. 语义搜索

### 数据模型

`SignalSummary` 新增字段：
```
embedding String?  // JSON 数组：[0.12, -0.34, ...] 768维
```

### Embedding 生成

- Pipeline 在生成 AI 摘要后，对 `Signal.title + Signal.description` 调用 embedding API
- 使用现有 AI Provider（DeepSeek/OpenAI embedding 端点）
- 维度统一截断到 768

### 搜索 API

```
GET /api/search?q=rust+cli&source=all&days=30&limit=10
```

逻辑：
- `q` 为空 → DB `title LIKE %q%` 模糊匹配
- `q` 有值 → 生成查询 embedding → 读取有 embedding 的 Summaries → 余弦相似度排序
- `source` 筛选，`days` 时间范围

### 搜索 UI

- ⌘K 面板增强：source 筛选按钮、时间范围下拉、搜索结果显示相似度百分比
- 300ms debounce 自动搜索
- 底部快捷键提示

---

## 3. 移动端适配

- 卡片：手机 1 列，`p-4 rounded-xl`
- Header：`h-12`，文字导航隐藏
- 所有 touch target ≥ 44×44px
- 卡片 hover → active 降级
- 搜索面板：`w-[calc(100vw-2rem)]`
- 设置/历史页：全宽 `px-4`
- Footer 手机端隐藏
- Input/Select 字号 ≥ 16px（防 iOS zoom）

---

## 4. API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search?q=&source=&days=&limit=` | 新增 |
| GET | `/api/signals?source=&limit=` | 不变 |
| — | 其他 | 不变 |

---

## 5. Pipeline

生成摘要后增加 embedding 步骤。为历史无 embedding 数据提供一次性迁移。

---

## 6. 技术要点

- Embedding 错误不影响摘要生成（容错降级）
- 相似度在前端展示为百分比
- 移动端用 Tailwind responsive utilities
