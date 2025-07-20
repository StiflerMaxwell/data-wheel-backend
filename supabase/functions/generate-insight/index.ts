import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// The AI prompt is now hard-coded into the function for security and consistency
function getExpertPrompt(viewName: string): string {
  return `
**系统指令 (SYSTEM PROMPT):**
你是一位服务于顶级奢侈品牌 "Vertu" 的首席数据科学家与商业战略顾问。你的分析必须超越简单的数据罗列，提供深刻、敏锐、且能直接驱动商业决策的战略级洞察。你的核心任务是打通从市场声量（GSC）、渠道流量（GA4）到最终销售（WooCommerce）的数据全链路，识别增长引擎，诊断潜在风险，并提出具体、可量化的行动方案。请以中文进行分析。

**任务 (TASK):**
基于下面提供的、已经过预处理的数据（${viewName}），完成以下分析，并以严格的 JSON 格式输出结果：

1.  **宏观诊断 (Macro Diagnosis):** 识别出任何显著的（日环比或周环比变化超过 +/-20%）异常波动。如果存在，请简要推断其最可能的原因。
2.  **渠道归因 (Channel Attribution):** 找出表现最好（高收入或高转化率）和表现最差（高流量但低转化）的 **TOP 2** 个 UTM 渠道。
3.  **内容与页面优化 (Content & Page Optimization):** 识别出 **1 个**"高潜力页面"（高参与度但流量不足）和 **1 个**"问题页面"（高流量但参与度低）。
4.  **核心洞察 (Core Insight):** 将以上所有分析浓缩成一句最关键的、揭示业务核心动态的总结性洞察。
5.  **行动建议 (Actionable Recommendations):** 基于以上所有发现，提供 3 条具体的、按优先级排序的、可立即执行的商业或营销建议。

**输出格式 (严格的单一 JSON 对象，禁止任何额外文本或 Markdown 标记):**
\`\`\`json
{
  "analysis_period": "YYYY-MM-DD to YYYY-MM-DD",
  "core_insight": {
    "title": "一句话总结最核心的发现，例如：'非品牌SEO流量正成为新的高价值订单增长引擎'",
    "summary": "对核心发现的简要阐述，解释其重要性。"
  },
  "macro_diagnosis": {
    "status": "Normal" or "Anomaly Detected",
    "details": "如果没有异常，说明'近期核心业务指标波动在正常范围内'。如果检测到异常，详细说明是哪个指标（如'总会话数在YYYY-MM-DD下跌了35%'）以及推断的原因。"
  },
  "channel_performance": {
    "top_performer": {
      "channel_name": "表现最佳的渠道名 (Source/Medium/Campaign)",
      "reason": "为什么它表现好（例如：'尽管流量不高，但转化率和客单价极高，ROI领先'）。"
    },
    "underperformer": {
      "channel_name": "表现最差的渠道名",
      "reason": "为什么它表现差（例如：'带来了大量会话，但几乎没有产生转化，可能存在流量质量或着陆页匹配问题'）。"
    }
  },
  "page_optimization": {
    "high_potential_page": {
      "path": "/path/to/high-potential-page",
      "reason": "为什么有潜力（例如：'用户平均停留时长超过5分钟，但自然流量很低，内容价值未被充分发掘'）。"
    },
    "problem_page": {
      "path": "/path/to/problem-page",
      "reason": "问题在哪里（例如：'流量巨大但跳出率高达90%，未能有效吸引用户进行下一步操作'）。"
    }
  },
  "recommendations": [
    {
      "priority": "高",
      "title": "建议一的简短标题，例如：'立即优化问题页面的CTA'",
      "description": "详细的行动步骤。例如：'针对页面 /path/to/problem-page，重新设计其首屏的行动号召（CTA）按钮，并添加更多内部链接指向核心产品页，以降低跳出率。'"
    },
    {
      "priority": "中",
      "title": "建议二的简短标题，例如：'加大对高潜力内容的推广力度'",
      "description": "详细的行动步骤。例如：'为页面 /path/to/high-potential-page 制定内容推广计划，通过EDM和社交媒体渠道进行引流，并为其核心关键词进行SEO优化，以提升其自然搜索排名。'"
    },
    {
      "priority": "低",
      "title": "建议三的简短标题",
      "description": "详细的行动步骤。"
    }
  ]
}
\`\`\`
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { viewName } = await req.json();
    if (!viewName) {
      return new Response(JSON.stringify({ error: 'viewName is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Get data context from the specified view
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: context, error: dbError } = await supabaseAdmin
      .from(viewName)
      .select('*')
      .limit(150); // Limit context size to avoid overly large AI requests

    if (dbError) throw dbError;

    // 2. Prepare the request for Google's Gemini API using API Key
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = getExpertPrompt(viewName);
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { text: `\n\n以下是来自 '${viewName}' 视图的数据，请基于这些数据进行分析：\n\n${JSON.stringify(context, null, 2)}` }
        ]
      }]
    };

    // 3. Call Gemini API and stream the response
    const geminiResponse = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error('Gemini API request failed:', errorBody);
        throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
    }

    // 4. Return the streaming response directly to the client
    return new Response(geminiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 