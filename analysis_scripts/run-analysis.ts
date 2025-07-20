/**
 * @file: analysis_scripts/run-analysis.ts
 * @description: 
 * 本地优先的 AI 分析脚本 (v-MCP)。
 * 负责:
 * 1. 从 Supabase 数据库的指定视图中读取数据上下文。
 * 2. 调用本地 MCP (Machine Coding Protocol) 能力进行 AI 分析。
 * 3. 将生成的洞察和建议写回 Supabase 数据库。
 * 
 * 使用方式:
 * - 运行: npx tsx analysis_scripts/run-analysis.ts <view_name>
 * - 示例: npx tsx analysis_scripts/run-analysis.ts page_optimization_view
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 配置 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL or Service Key is not defined in .env.local');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- 核心函数 ---

/**
 * 从指定的 Supabase 视图中获取数据上下文。
 * @param viewName - 要查询的视图名称。
 * @returns - 从视图中获取的数据数组。
 */
async function getContextFromView(viewName: string): Promise<any[]> {
  console.log(`Fetching context from view: ${viewName}...`);
  const { data, error } = await supabase
    .from(viewName)
    .select('*')
    .limit(100); // 获取最多100条记录作为上下文

  if (error) {
    console.error(`Error fetching from view ${viewName}:`, error);
    throw error;
  }
  console.log(`Successfully fetched ${data.length} records.`);
  return data;
}

/**
 * [模拟] 调用本地 MCP (Machine Coding Protocol) 进行 AI 分析。
 * 注意：这是一个模拟函数。请在此处替换为您真实的本地 MCP SDK 调用。
 * @param context - 从数据库获取的数据上下文。
 * @param promptInstructions - 指导 AI 分析的指令。
 * @returns - 结构化的 AI 分析结果。
 */
async function callLocalMcp(context: any[], promptInstructions: string): Promise<any> {
  console.log("\n--- Calling Local Supabase MCP (Mock) ---");
  console.log("Instructions:", promptInstructions);
  console.log(`Context data size: ${context.length} records`);

  // --- 在这里替换为您的真实 MCP SDK 调用 ---
  // const aiResult = await mcp.generate({ prompt: promptInstructions, context });
  // return aiResult;
  // -----------------------------------------

  // 返回一个符合预期的、结构化的模拟响应
  await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟网络延迟
  
  const mockResult = {
    insight_title: "MCP 模拟分析：高潜力优化机会",
    insight_summary: "通过对提供的数据上下文进行模拟分析，我们发现 'page_optimization_view' 中的首页 ('/') 表现出高流量但跳出率也较高的双重特性，这是一个典型的“漏水桶”现象，亟待优化。",
    recommendations: [
      { description: "针对首页（'/'）进行 A/B 测试，优化首屏内容和CTA按钮。", status: "new" },
      { description: "分析高跳出率页面的用户录屏，定位用户流失的具体原因。", status: "new" },
      { description: "为高流量但转化低的页面增加内部链接，引导用户访问转化页面。", status: "new" },
    ]
  };

  console.log("--- Mock MCP call successful ---");
  return mockResult;
}

/**
 * 将 AI 生成的洞察和建议保存到数据库。
 * @param aiResult - 包含洞察和建议的结构化对象。
 */
async function saveInsightsToDB(aiResult: any) {
  console.log("\n--- Saving insights to Supabase DB ---");

  const { insight_title, insight_summary, recommendations } = aiResult;
  
  // 1. 插入主洞察
  const { data: insight, error: insightError } = await supabase
    .from('insights')
    .insert({ title: insight_title, summary: insight_summary })
    .select()
    .single();

  if (insightError) {
    console.error('Error saving insight:', insightError);
    throw insightError;
  }
  console.log(`Insight saved successfully with ID: ${insight.id}`);

  // 2. 插入关联的建议
  if (recommendations && recommendations.length > 0) {
    const recommendationsToInsert = recommendations.map((rec: any) => ({
      insight_id: insight.id,
      description: rec.description,
      status: rec.status || 'new',
    }));

    const { error: recommendationsError } = await supabase
      .from('recommendations')
      .insert(recommendationsToInsert);

    if (recommendationsError) {
      console.error('Error saving recommendations:', recommendationsError);
      throw recommendationsError;
    }
    console.log(`${recommendations.length} recommendations saved successfully.`);
  }
}

/**
 * 主执行函数
 */
async function main() {
  // 从命令行参数获取视图名称
  const viewName = process.argv[2];
  if (!viewName) {
    console.error("错误: 请提供一个视图名称作为命令行参数。");
    console.log("用法: npx tsx analysis_scripts/run-analysis.ts <view_name>");
    console.log("可用视图: daily_kpi_summary_view, utm_funnel_performance_view, page_optimization_view");
    process.exit(1);
  }

  const promptInstructions = `
# Role & Goal
You are a world-class e-commerce strategy consultant for a premier luxury brand. Your task is to analyze the provided dataset (from the '${viewName}' view) to uncover deep, non-obvious insights that a typical data analyst might overlook. Move beyond simplistic metrics like "high traffic" and focus on what drives brand value, enhances the luxury customer experience, and increases high-quality revenue.

# Analysis Focus Areas
Based on the data, I want you to specifically investigate:
1.  **High-Value Customer Journey:** Identify page paths or user behaviors that correlate with high average order value or purchases of signature items, not just overall session count.
2.  **Hidden Friction Points:** Pinpoint pages or sequences where potential high-value customers (e.g., those interacting with expensive products) show signs of friction (e.g., high exit rate, low time-on-page) that aren't apparent in the overall site average.
3.  **Untapped Potential:** Discover pages that, despite having moderate traffic, are failing to convert or engage users effectively. What is the missed opportunity, especially for pages featuring new collections or high-margin products?
4.  **Device-as-a-Signal:** Is there a discernible difference in behavior between users on premium devices (e.g., latest iPhones) versus others? What could this imply about our digital tailoring?

# Output Format
Present your findings in a structured, actionable report. Use the following format strictly in Chinese:

### 核心洞察 (Core Insight)
(Provide a single, concise paragraph summarizing your most critical finding. This should be the "aha!" moment.)

### 行动建议 (Actionable Recommendations)
(Provide at least three concrete, practical recommendations. Each recommendation MUST follow this structure:)

**1. 行动 (Action):** (Describe the specific action to take. Be direct and clear. e.g., "针对 'The Duchess' 手袋系列页面，推出一个以视频为核心的沉浸式体验优化。")
**负责板块 (Owner):** (Assign this action to a specific business unit. e.g., "网站内容与UX团队")
**理由 (Rationale):** (Explain *why* this action is necessary, directly linking it back to your core insight and the data. e.g., "数据显示，高端用户在此页面的停留时间远低于预期，表明当前纯图片展示未能有效传达产品的工艺与价值，导致潜力客户流失。")

**2. 行动 (Action):** ...
**负责板块 (Owner):** ...
**理由 (Rationale):** ...

**3. 行动 (Action):** ...
**负责板块 (Owner):** ...
**理由 (Rationale):** ...
`;

  try {
    // 1. 从 Supabase 视图获取数据
    const context = await getContextFromView(viewName);
    
    // 2. 调用本地 MCP 进行分析
    const aiResult = await callLocalMcp(context, promptInstructions);
    
    // 3. 将结果保存到数据库
    await saveInsightsToDB(aiResult);
    
    console.log("\n✅ 本地 AI 分析流程成功完成！");

  } catch (error) {
    console.error("\n❌ 本地 AI 分析流程失败:", error.message);
    process.exit(1);
  }
}

// --- 启动脚本 ---
main(); 