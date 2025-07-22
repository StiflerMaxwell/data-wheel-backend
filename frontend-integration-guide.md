# 数据分析平台后端 - 前端集成指南

本文档旨在帮助前端开发人员与数据分析平台的后端 API 进行集成。

## 基本信息

- **Supabase 项目 URL**: `https://rrfurkgzyliqudkjmckk.supabase.co`
- **匿名 Key (Anon Key)**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZnVya2d6eWxpcXVka2ptY2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk2NjQsImV4cCI6MjA2ODM5NTY2NH0.HQCqzJvEJiKK2W_ibUQbm7p2C2CwV7gUpMBegbYs0QU`

建议使用 Supabase 官方的 JavaScript 客户端库 (`@supabase/supabase-js`) 进行交互，它能更好地处理认证和数据获取。

## Edge Function API

所有 Edge Function 的基础路径为： `https://rrfurkgzyliqudkjmckk.supabase.co/functions/v1/`

### 1. 按需同步数据 (`/sync-external-data`)

- **方法**: `POST`
- **认证**: 需要 `anon` key
- **功能**: 触发一个或多个外部数据源的同步任务。
- **请求 Body** (JSON):

```json
{
  "sources": ["woocommerce", "ga4", "gsc", "pagespeed", "clarity"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "pageUrls": [
    "https://example.com",
    "https://example.com/product"
  ],
  "clarityProjectId": "your-clarity-project-id"
}
```

- **参数说明**:
  - `sources` (必需): `string[]` - 要同步的数据源数组。可选值: `"woocommerce"`, `"ga4"`, `"gsc"`, `"pagespeed"`, `"clarity"`。
  - `startDate` (可选): `string` - 数据同步的开始日期 (格式 `YYYY-MM-DD`)。
  - `endDate` (可选): `string` - 数据同步的结束日期 (格式 `YYYY-MM-DD`)。
  - `pageUrls` (可选): `string[]` - 当 `sources` 包含 `"pagespeed"` 时需要。要分析的页面 URL 列表。
  - `clarityProjectId` (可选): `string` - 当 `sources` 包含 `"clarity"` 时需要。Clarity 项目的 ID。

- **示例调用 (JavaScript `fetch`)**:

```javascript
const response = await fetch('https://rrfurkgzyliqudkjmckk.supabase.co/functions/v1/sync-external-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({
    sources: ['woocommerce', 'ga4'],
    startDate: '2025-07-01',
    endDate: '2025-07-20'
  })
});
const result = await response.json();
console.log(result);
```

### 2. 获取转化漏斗数据 (`/get-conversion-funnel`)

- **方法**: `POST`
- **认证**: 需要 `anon` key
- **功能**: 获取指定日期范围内的转化漏斗数据。
- **请求 Body** (JSON):

```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
```

- **成功响应示例**:

```json
{
  "stages": [
    { "name": "访问用户", "value": 1500 },
    { "name": "浏览商品", "value": 1200 },
    { "name": "加入购物车", "value": 300 },
    { "name": "开始结账", "value": 150 },
    { "name": "完成购买", "value": 100 }
  ]
}
```

### 3. 获取洞察详情 (`/get-insight-details`)

- **方法**: `POST`
- **认证**: 需要 `anon` key
- **功能**: 获取单个洞察的详细信息，包括建议、上下文数据和负责人信息。
- **请求 Body** (JSON):

```json
{
  "insightId": "your-insight-id"
}
```

- **成功响应示例**:

```json
{
  "insight": {
    "id": "1",
    "title": "移动端用户转化率较低",
    "summary": "...",
    "created_at": "...",
    "type": "performance",
    "importance": "high",
    "recommendations": [
      {
        "id": "rec-1",
        "description": "优化移动端页面加载速度",
        "status": "pending",
        "assignee_id": "user-uuid-1",
        "due_date": "2025-08-01",
        "feedback": null
      }
    ]
  },
  "context_data": [
    { "date": "2025-07-20", "total_revenue": 5000, "valid_orders": 10, ... },
    ...
  ],
  "assigned_users": {
    "user-uuid-1": {
      "id": "user-uuid-1",
      "full_name": "张三",
      "avatar_url": "https://..."
    }
  }
}
```

## 数据库 RPC 调用

除了 Edge Functions，前端也可以直接调用数据库的 RPC 函数来获取数据。

### 1. 查看定时任务 (`list_cron_jobs`)

- **功能**: 获取所有已配置的定时任务列表。
- **示例调用 (`supabase-js`)**:

```javascript
const { data, error } = await supabase.rpc('list_cron_jobs');

if (error) console.error('Error fetching cron jobs:', error);
else console.log('Cron Jobs:', data);
```

### 2. 创建、删除、运行定时任务

- `create_cron_job(job_name, job_schedule, job_command)`
- `delete_cron_job(job_id)`
- `run_cron_job(job_id)`

这些函数主要用于管理后台，前端可以根据需求暴露这些功能给管理员。

## RLS (行级安全)

所有数据表都配置了 RLS 策略。前端在进行数据操作 (SELECT, INSERT, UPDATE, DELETE) 时，需要使用用户的 JWT 进行认证，以确保用户只能访问其有权访问的数据。

使用 `supabase-js` 客户端时，登录后会自动处理 JWT 的传递。

## 注意事项

- **错误处理**: API 会在发生错误时返回相应的 HTTP 状态码 (如 400, 404, 500) 和一个包含 `error` 字段的 JSON Body。前端应妥善处理这些错误。
- **性能**: 对于需要大量计算的请求，后端可能需要一些时间来响应。建议在前端实现加载状态 (Loading Spinners) 以提升用户体验。
- **版本控制**: 未来 API 可能会更新。请关注本文档的更新，以确保兼容性。 