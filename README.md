# Middle East Conflict Monitor Prototype

这次已经不是纯静态页面，而是一个**前后端一体的最小可用原型**：

- 前端负责展示新闻流、地图、词云、态势摘要
- 后端负责输出统一的 `/api/dashboard` JSON
- 示例数据仍然来自 `data/sample-data.json`，但访问路径已经改成 API 方式

## 我建议你采用哪种方式？

**更方便、也更适合后续扩展的方式是：后端聚合 API + 前端看板。**

因为你最终要做的是一个“持续更新的新闻情报系统”，不是单页展示：

- 需要多个新闻源聚合
- 需要统一结构
- 需要做关键词、地点、地图打点、去重、摘要
- 这些都更适合先在后端做，再输出给前端

## 这版新增了什么

### 1. 本地 API 服务
新增 `api_server.py`，提供：

- `GET /api/dashboard`
- 支持查询参数：
  - `topic`
  - `keyword`
  - `hours`

例如：

```text
/api/dashboard?topic=israel-iran&keyword=tehran&hours=168
```

### 2. 前端改为走 API
前端不再直接读取 `data/sample-data.json`，而是调用后端接口。
这样后面你把示例数据替换成 RSS / GDELT / News API 的聚合结果时，前端基本不用改。

### 3. 数据结构仍保持标准化
后端输出的 JSON 结构仍然是：

```json
{
  "meta": {
    "mode": "api-demo",
    "lastUpdated": "2026-03-18T13:00:00Z",
    "filters": {
      "topic": "israel-iran",
      "keyword": "tehran",
      "hours": "168"
    }
  },
  "articles": [
    {
      "id": 101,
      "title": "...",
      "summary": "...",
      "source": "...",
      "url": "https://...",
      "publishedAt": "2026-03-18T11:20:00Z",
      "topic": "israel-iran",
      "locations": [{ "name": "Tehran", "lat": 35.6892, "lng": 51.389 }],
      "keywords": ["Iran", "missile", "ceasefire"]
    }
  ]
}
```

## 当前文件说明

- `index.html`：页面骨架与模块布局
- `styles.css`：看板样式
- `app.js`：前端渲染与 API 请求逻辑
- `api_server.py`：本地 API + 静态文件服务
- `data/sample-data.json`：示例数据源

## 运行方式

```bash
python3 api_server.py
```

然后访问：

```text
http://localhost:8000
```

API 示例：

```text
http://localhost:8000/api/dashboard
http://localhost:8000/api/dashboard?topic=us-israel&hours=168
http://localhost:8000/api/dashboard?topic=israel-iran&keyword=tehran
```

## 你下一步最值得做的事

如果你继续做真实版本，建议按这个顺序：

1. 在 `api_server.py` 背后接真实新闻源
2. 在后端做去重、关键词提取、地点识别
3. 保持前端消费同一个 `/api/dashboard` 接口
4. 后面再加自动刷新、时间线、事件聚类

如果你要，我下一步可以直接继续帮你把 `api_server.py` 升级成：

- 抓 RSS / GDELT 的真实聚合器
- 自动抽取地点
- 自动生成词云关键词
