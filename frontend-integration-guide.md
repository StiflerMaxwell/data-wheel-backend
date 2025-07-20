# 奢侈品电商数据分析平台 - 前端集成文档

## 目录

1. [概述](#概述)
2. [环境配置](#环境配置)
3. [身份验证](#身份验证)
4. [数据视图接口](#数据视图接口)
5. [AI 洞察生成](#ai-洞察生成)
6. [洞察保存与检索](#洞察保存与检索)
7. [组件示例](#组件示例)
8. [最佳实践](#最佳实践)
9. [常见问题](#常见问题)

## 概述

本文档详细说明如何将前端应用与奢侈品电商数据分析平台的 Supabase 后端进行集成。该平台提供以下核心功能：

- **数据视图查询**：访问预构建的业务智能视图
- **AI 分析引擎**：基于 Google Gemini 2.5 的智能分析
- **洞察管理**：保存、检索和管理 AI 生成的洞察

## 环境配置

### 安装依赖

```bash
# 使用 npm
npm install @supabase/supabase-js

# 或使用 yarn
yarn add @supabase/supabase-js
```

### 初始化 Supabase 客户端

```javascript
// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rrfurkgzyliqudkjmckk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZnVya2d6eWxpcXVka2ptY2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk2NjQsImV4cCI6MjA2ODM5NTY2NH0.HQCqzJvEJiKK2W_ibUQbm7p2C2CwV7gUpMBegbYs0QU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 环境变量设置 (Next.js)

```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://rrfurkgzyliqudkjmckk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZnVya2d6eWxpcXVka2ptY2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk2NjQsImV4cCI6MjA2ODM5NTY2NH0.HQCqzJvEJiKK2W_ibUQbm7p2C2CwV7gUpMBegbYs0QU
```

## 身份验证

### 用户登录

```javascript
async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('登录失败:', error.message);
    throw error;
  }
}
```

### 用户登出

```javascript
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('登出失败:', error.message);
    throw error;
  }
}
```

### 获取当前用户

```javascript
function getCurrentUser() {
  return supabase.auth.getUser();
}
```

### 监听认证状态变化

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // 用户登录
    console.log('用户已登录:', session.user);
  } else if (event === 'SIGNED_OUT') {
    // 用户登出
    console.log('用户已登出');
  }
});
```

## 数据视图接口

### 核心业务视图

系统提供三个主要的业务智能视图：

1. **页面优化分析** (`page_optimization_view`)
2. **宏观健康度监控** (`daily_kpi_summary_view`)
3. **UTM 渠道漏斗性能** (`utm_funnel_performance_view`)

### 查询视图数据

```javascript
async function fetchViewData(viewName, options = {}) {
  try {
    let query = supabase.from(viewName).select('*');
    
    // 应用日期范围过滤
    if (options.startDate && options.endDate) {
      query = query.gte('date', options.startDate).lte('date', options.endDate);
    }
    
    // 应用分页
    if (options.page && options.pageSize) {
      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    }
    
    // 应用排序
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending });
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    return { data, count };
  } catch (error) {
    console.error(`获取 ${viewName} 数据失败:`, error.message);
    throw error;
  }
}

// 使用示例
const { data: pageData } = await fetchViewData('page_optimization_view', {
  startDate: '2025-06-01',
  endDate: '2025-06-30',
  page: 1,
  pageSize: 20,
  orderBy: 'total_sessions',
  ascending: false
});
```

### 获取聚合指标

```javascript
async function fetchAggregateMetrics(viewName, metrics, filters = {}) {
  try {
    let query = supabase.from(viewName).select(metrics.join(','));
    
    // 应用过滤条件
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`获取聚合指标失败:`, error.message);
    throw error;
  }
}

// 使用示例
const totalRevenue = await fetchAggregateMetrics(
  'daily_kpi_summary_view',
  ['sum(total_revenue) as revenue'],
  { date: '2025-07-01' }
);
```

## AI 洞察生成

### 调用 AI 分析引擎 (流式响应)

```javascript
async function generateInsight(viewName, setStreamingContent) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user) throw new Error('用户未登录');

    const response = await fetch(
      'https://rrfurkgzyliqudkjmckk.supabase.co/functions/v1/generate-insight',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
        },
        body: JSON.stringify({ viewName })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 分析失败 (${response.status}): ${errorText}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      result += chunk;
      
      // 更新 UI 显示流式内容
      if (setStreamingContent) {
        setStreamingContent(result);
      }
    }

    return result;
  } catch (error) {
    console.error('生成洞察失败:', error.message);
    throw error;
  }
}
```

### React 组件示例

```jsx
import { useState } from 'react';
import { marked } from 'marked'; // 用于 Markdown 渲染

function InsightGenerator() {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewName, setViewName] = useState('page_optimization_view');
  
  const generateInsight = async () => {
    setLoading(true);
    setInsight('');
    
    try {
      await generateInsight(viewName, setInsight);
    } catch (error) {
      console.error(error);
      setInsight(`生成失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      <div className="mb-4">
        <label className="block mb-2">选择分析视图:</label>
        <select 
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="page_optimization_view">页面优化分析</option>
          <option value="daily_kpi_summary_view">宏观健康度监控</option>
          <option value="utm_funnel_performance_view">UTM 渠道漏斗性能</option>
        </select>
      </div>
      
      <button 
        onClick={generateInsight}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? '生成中...' : '生成洞察'}
      </button>
      
      {insight && (
        <div className="mt-6 p-4 border rounded bg-white">
          <div 
            dangerouslySetInnerHTML={{ __html: marked(insight) }} 
            className="prose max-w-none"
          />
        </div>
      )}
    </div>
  );
}
```

## 洞察保存与检索

### 保存 AI 生成的洞察

```javascript
async function saveInsight(insightData) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user) throw new Error('用户未登录');
    
    const response = await fetch(
      'https://rrfurkgzyliqudkjmckk.supabase.co/functions/v1/save-insight',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
        },
        body: JSON.stringify(insightData)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`保存洞察失败 (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('保存洞察失败:', error.message);
    throw error;
  }
}

// 使用示例
const insightData = {
  insight_title: '高端设备用户的购买行为分析',
  insight_summary: '使用高端移动设备（如iPhone Pro系列）的用户在奢侈品购买中表现出明显更高的转化率和平均订单价值。这些用户在浏览产品详情页时，对视频内容的参与度是普通用户的3倍，但在纯文字描述页面的停留时间却低于平均水平。',
  recommendations: [
    {
      description: '为高端设备用户优化产品详情页，增加高质量视频内容展示',
      priority: 'High'
    },
    {
      description: '针对高端设备用户开发专属的AR试用功能',
      priority: 'Medium'
    },
    {
      description: '在移动端检测到高端设备时，推送限量版产品推荐',
      priority: 'Low'
    }
  ]
};

const result = await saveInsight(insightData);
console.log('保存成功，洞察ID:', result.insight_id);
```

### 获取保存的洞察列表

```javascript
async function fetchInsights(options = {}) {
  try {
    let query = supabase.from('insights').select(`
      id,
      title,
      summary,
      created_at,
      recommendations (
        id,
        description,
        priority
      )
    `);
    
    // 应用分页
    if (options.page && options.pageSize) {
      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    }
    
    // 应用排序
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending });
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    return { data, count };
  } catch (error) {
    console.error('获取洞察列表失败:', error.message);
    throw error;
  }
}

// 使用示例
const { data: insights } = await fetchInsights({
  page: 1,
  pageSize: 10,
  orderBy: 'created_at',
  ascending: false
});
```

### 获取单个洞察详情

```javascript
async function fetchInsightDetail(insightId) {
  try {
    const { data, error } = await supabase
      .from('insights')
      .select(`
        id,
        title,
        summary,
        created_at,
        recommendations (
          id,
          description,
          priority
        )
      `)
      .eq('id', insightId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`获取洞察 ${insightId} 详情失败:`, error.message);
    throw error;
  }
}
```

## 组件示例

### 洞察列表组件

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function InsightsList() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadInsights() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('insights')
          .select(`
            id,
            title,
            summary,
            created_at,
            recommendations (count)
          `)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setInsights(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadInsights();
  }, []);
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">AI 洞察列表</h2>
      
      {insights.length === 0 ? (
        <p>暂无洞察数据</p>
      ) : (
        insights.map(insight => (
          <div key={insight.id} className="border p-4 rounded shadow-sm">
            <h3 className="text-xl font-semibold">{insight.title}</h3>
            <p className="text-gray-600 text-sm">
              {new Date(insight.created_at).toLocaleString('zh-CN')}
            </p>
            <p className="mt-2">{insight.summary}</p>
            <div className="mt-2 text-blue-600">
              {insight.recommendations.count} 条建议
            </div>
            <a 
              href={`/insights/${insight.id}`}
              className="mt-2 inline-block text-blue-600 hover:underline"
            >
              查看详情
            </a>
          </div>
        ))
      )}
    </div>
  );
}
```

### 洞察详情组件

```jsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function InsightDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!id) return;
    
    async function loadInsightDetail() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('insights')
          .select(`
            id,
            title,
            summary,
            created_at,
            recommendations (
              id,
              description,
              priority
            )
          `)
          .eq('id', id)
          .single();
        
        if (error) throw error;
        setInsight(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadInsightDetail();
  }, [id]);
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  if (!insight) return <div>未找到洞察</div>;
  
  // 根据优先级获取标签颜色
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <button 
        onClick={() => router.back()}
        className="mb-4 text-blue-600 hover:underline"
      >
        &larr; 返回
      </button>
      
      <h1 className="text-3xl font-bold mb-2">{insight.title}</h1>
      <p className="text-gray-600 mb-6">
        创建于 {new Date(insight.created_at).toLocaleString('zh-CN')}
      </p>
      
      <div className="bg-blue-50 p-4 rounded mb-8">
        <h2 className="text-xl font-semibold mb-2">核心洞察</h2>
        <p>{insight.summary}</p>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">行动建议</h2>
        <div className="space-y-4">
          {insight.recommendations.map(rec => (
            <div key={rec.id} className="border p-4 rounded">
              <div className="flex justify-between items-start">
                <p className="font-medium">{rec.description}</p>
                <span className={`px-2 py-1 rounded text-sm ${getPriorityColor(rec.priority)}`}>
                  {rec.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 最佳实践

### 数据加载优化

1. **分页加载**：对于大型数据集，始终使用分页加载而不是一次性获取所有数据。
2. **选择性查询**：仅查询需要的列，避免不必要的数据传输。
3. **缓存策略**：对于不经常变化的数据，实现客户端缓存。

### 错误处理

```javascript
try {
  const { data, error } = await supabase.from('view_name').select('*');
  
  if (error) {
    // 处理 Supabase 错误
    if (error.code === 'PGRST116') {
      // 处理权限错误
      console.error('权限不足，请检查 RLS 策略');
    } else {
      // 处理其他错误
      console.error('查询错误:', error.message);
    }
    return;
  }
  
  // 处理成功响应
  console.log('获取到数据:', data);
} catch (unexpectedError) {
  // 处理意外错误
  console.error('发生意外错误:', unexpectedError);
}
```

### 实时订阅

对于需要实时更新的数据，可以使用 Supabase 的实时订阅功能：

```javascript
const subscription = supabase
  .from('insights')
  .on('INSERT', payload => {
    console.log('新的洞察已添加:', payload.new);
    // 更新 UI
  })
  .on('UPDATE', payload => {
    console.log('洞察已更新:', payload.new);
    // 更新 UI
  })
  .subscribe();

// 在组件卸载时取消订阅
return () => {
  supabase.removeSubscription(subscription);
};
```

## 常见问题

### 1. 认证令牌过期

**问题**：API 调用返回 401 未授权错误。

**解决方案**：
- 检查用户是否已登录
- 刷新认证令牌
- 如果令牌已过期，重新引导用户登录

```javascript
// 刷新令牌
const { data, error } = await supabase.auth.refreshSession();
if (error) {
  // 令牌无法刷新，需要重新登录
  await supabase.auth.signOut();
  // 重定向到登录页
  window.location.href = '/login';
}
```

### 2. RLS 策略限制

**问题**：即使用户已登录，某些查询仍然返回权限错误。

**解决方案**：
- 确认用户角色是否有权访问请求的数据
- 检查 RLS 策略是否正确配置
- 对于需要特殊权限的操作，考虑使用 Edge Functions

### 3. AI 分析超时

**问题**：AI 分析请求超时或失败。

**解决方案**：
- 减少分析的数据量，使用更精确的过滤条件
- 对于大型数据集，考虑分批处理
- 实现重试机制

```javascript
async function generateInsightWithRetry(viewName, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await generateInsight(viewName);
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      
      // 指数退避策略
      const delay = 1000 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

本文档涵盖了与奢侈品电商数据分析平台 Supabase 后端集成的所有核心功能。如有任何疑问或需要进一步的支持，请联系技术支持团队。 