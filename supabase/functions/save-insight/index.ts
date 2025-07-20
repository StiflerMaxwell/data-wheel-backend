import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

console.log("save-insight function initialized (v3 with Zod, compatible with generate-insight output)");

// 定义 generate-insight 返回的 JSON 格式的 Schema
const GenerateInsightSchema = z.object({
  analysis_period: z.string().optional(),
  core_insight: z.object({
    title: z.string().min(5, {
      message: "Title must be at least 5 characters long."
    }),
    summary: z.string().min(10, {
      message: "Summary must be at least 10 characters long."
    })
  }),
  macro_diagnosis: z.object({
    status: z.string().optional(),
    details: z.string().optional()
  }).optional(),
  channel_performance: z.object({
    top_performer: z.object({
      channel_name: z.string().optional(),
      reason: z.string().optional()
    }).optional(),
    underperformer: z.object({
      channel_name: z.string().optional(),
      reason: z.string().optional()
    }).optional()
  }).optional(),
  page_optimization: z.object({
    high_potential_page: z.object({
      path: z.string().optional(),
      reason: z.string().optional()
    }).optional(),
    problem_page: z.object({
      path: z.string().optional(),
      reason: z.string().optional()
    }).optional()
  }).optional(),
  recommendations: z.array(z.object({
    priority: z.string().optional(),
    title: z.string().min(3, {
      message: "Recommendation title must be at least 3 characters long."
    }),
    description: z.string().min(5, {
      message: "Recommendation description must be at least 5 characters long."
    })
  }))
});

// 原始的 Schema，保持向后兼容
const OriginalInsightSchema = z.object({
  insight_title: z.string().min(5, {
    message: "Title must be at least 5 characters long."
  }),
  insight_summary: z.string().min(10, {
    message: "Summary must be at least 10 characters long."
  }),
  recommendations: z.array(z.object({
    description: z.string().min(5, {
      message: "Recommendation description must be at least 5 characters long."
    }),
    // 允许 status 是可选的，如果前端不传，我们后端会提供默认值
    status: z.string().optional().default('new')
  }))
});

// 合并两种格式的 Schema
const CombinedSchema = z.union([GenerateInsightSchema, OriginalInsightSchema]);

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // 1. 从请求体中解析数据
    const body = await req.json();
    
    // 2. 使用 Zod 进行严格的输入校验
    const parsedBody = CombinedSchema.safeParse(body);
    
    if (!parsedBody.success) {
      // 如果校验失败，返回详细的错误信息
      return new Response(JSON.stringify({
        error: 'Invalid request body',
        issues: parsedBody.error.issues
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 3. 根据数据格式进行不同处理
    let insight_title: string;
    let insight_summary: string;
    let recommendations: Array<{ description: string, status: string }>;
    
    // 检测是哪种格式的数据
    if ('core_insight' in parsedBody.data) {
      // generate-insight 格式
      const data = parsedBody.data;
      insight_title = data.core_insight.title;
      insight_summary = data.core_insight.summary;
      
      // 转换 recommendations 格式
      recommendations = data.recommendations.map(rec => ({
        description: `${rec.title || ''}: ${rec.description}`,
        status: 'new'
      }));
      
      console.log('Processing generate-insight format data');
    } else {
      // 原始格式
      const data = parsedBody.data;
      insight_title = data.insight_title;
      insight_summary = data.insight_summary;
      recommendations = data.recommendations;
      
      console.log('Processing original format data');
    }

    // 4. 创建一个拥有管理员权限的 Supabase 客户端
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 5. 将核心洞察插入 'insights' 表
    console.log(`Inserting insight: "${insight_title}"`);
    const { data: insight, error: insightError } = await supabaseAdmin
      .from('insights')
      .insert({
        title: insight_title,
        summary: insight_summary
      })
      .select()
      .single();

    if (insightError) {
      console.error('Error inserting into insights table:', insightError);
      throw insightError;
    }

    if (!insight) {
      throw new Error('Failed to insert insight, no data returned.');
    }

    console.log(`Insight created with ID: ${insight.id}`);

    // 6. 如果有建议，则将它们关联 insight_id 后插入 'recommendations' 表
    if (recommendations.length > 0) {
      const recommendationsToInsert = recommendations.map(rec => ({
        insight_id: insight.id,
        description: rec.description,
        status: rec.status || 'new'
      }));

      console.log(`Inserting ${recommendationsToInsert.length} recommendations...`);
      const { error: recommendationsError } = await supabaseAdmin
        .from('recommendations')
        .insert(recommendationsToInsert);

      if (recommendationsError) {
        console.error('Error inserting into recommendations table:', recommendationsError);
        throw recommendationsError;
      }
    }

    // 7. 返回成功响应
    return new Response(JSON.stringify({
      success: true,
      message: 'Insight and recommendations saved successfully.',
      insight_id: insight.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (err) {
    console.error('Error in save-insight function:', err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}); 