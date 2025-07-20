数据分析平台 - 后端开发执行手册 (v3.2 - 包含精要数据策略)
文档ID: DAP-BE-SDD-v3.2
密级: 内部机密
状态: 正式发布
核心架构: Supabase (PostgreSQL, 数据库视图, Edge Functions, pg_cron)
项目定位: 一个完全在 Supabase 生态内实现的、自动化的、为前端实时分析提供高质量“数据燃料”的后端系统。
前置条件：精要数据拉取策略 (The "Essential Data" Strategy)
在进行任何开发之前，我们必须明确数据管道的目标。我们的系统不追求全量数据同步，而是采用价值驱动的精要拉取策略，只获取能够支撑核心商业问题分析的数据。
核心商业分析框架:
宏观健康度监控: 发现整体业务的异常波动。
渠道效果归因: 定位波动的原因，评估营销 ROI。
用户行为与页面优化: 深潜数据，寻找转化优化机会。
各数据源的精要数据集定义:
数据源	数据集定义	目标与 rationale
Google Search Console (GSC)	1. 每日 Top 50 关键词 (按点击量)<br>2. 每日 Top 50 页面 (按点击量)<br>3. 每周趋势数据 (过去7天 vs. 上个7天对比)	捕获最重要的流量来源（基本盘），同时通过趋势对比快速发现增长机会和风险预警（流动性）。
Google Analytics 4 (GA4)	1. 渠道效果数据集 (Top 100):<br> - 维度: sessionSource, sessionMedium, sessionCampaignName<br> - 指标: sessions, conversions, totalUsers<br>2. 页面行为数据集 (Top 200):<br> - 维度: pagePath, country, deviceCategory<br> - 指标: sessions, bounceRate, averageSessionDuration, addToCarts, checkouts	将数据拆分为“渠道”和“页面”两个关注点，分别用于归因分析和内容优化，数据目标更清晰。
WooCommerce	所有订单 (All Orders):<br> - 状态: 拉取所有状态的订单 (completed, processing, on-hold, failed, cancelled)。<br> - 关键字段: 订单详情、总额、以及包含归因信息（_ga_cid, UTMs）的 meta_data。	订单量不大，全量拉取最可靠。在数据库视图层面进行成功/失败分组，为“失败归因”这一深度分析提供原材料。
第一阶段：数据建模层 - 构建商业智能“大脑” (预计 2-3 天)
目标： 在 Supabase 数据库中，基于现有的 raw_... 表，创建一系列高性能的、可直接用于深度分析的 SQL 视图。这是整个系统的“智能核心”。
任务 ID	✅	任务描述	详细执行步骤与 SQL 示例	验收标准
BE-1.1	☐	创建宏观健康度监控视图	1. 登录 Supabase Studio -> SQL Editor。<br>2. 编写并执行 SQL 创建一个视图，用于每日 KPI 的聚合与环比计算。<br> sql<br> CREATE OR REPLACE VIEW daily_kpi_summary_view AS<br> WITH daily_ga_metrics AS (<br> SELECT date, SUM(sessions) as total_sessions, SUM(total_users) as total_users<br> FROM raw_ga4_data -- 假设已有这些聚合指标<br> GROUP BY date<br> ),<br> daily_woo_metrics AS (<br> SELECT date(created_at) as date, COUNT(order_id) as total_orders, SUM(total) as total_revenue<br> FROM raw_woocommerce_orders<br> WHERE status IN ('completed', 'processing', 'on-hold')<br> GROUP BY date(created_at)<br> )<br> SELECT<br> COALESCE(ga.date, woo.date) as report_date,<br> COALESCE(ga.total_sessions, 0) AS total_sessions,<br> COALESCE(woo.total_orders, 0) AS total_orders,<br> COALESCE(woo.total_revenue, 0) AS total_revenue,<br> LAG(COALESCE(ga.total_sessions, 0), 1) OVER (ORDER BY COALESCE(ga.date, woo.date)) as prev_day_sessions,<br> LAG(COALESCE(woo.total_orders, 0), 7) OVER (ORDER BY COALESCE(ga.date, woo.date)) as prev_week_orders<br> FROM daily_ga_metrics ga<br> FULL OUTER JOIN daily_woo_metrics woo ON ga.date = woo.date; -- 使用 FULL OUTER JOIN 确保日期完整<br>	视图 daily_kpi_summary_view 创建成功。查询该视图能返回每日的核心指标及其日/周同比数据。
BE-1.2	☐	创建 UTM 渠道漏斗性能视图	1. 在 SQL Editor 中，编写并执行 SQL 创建一个视图，用于计算各渠道的完整转化漏斗。<br> sql<br> CREATE OR REPLACE VIEW utm_funnel_performance_view AS<br> WITH channel_sessions AS (<br> SELECT<br> (ga4_data ->> 'sessionSourceMedium') AS channel,<br> (ga4_data ->> 'sessionCampaignName') AS campaign,<br> (ga4_data ->> 'clientId') AS client_id,<br> COUNT(*) as sessions<br> FROM raw_ga4_channel_data -- 使用渠道数据集<br> GROUP BY channel, campaign, client_id<br> ),<br> channel_orders AS (<br> SELECT<br> (SELECT value ->> 'value' FROM jsonb_array_elements(order_data -> 'meta_data') WHERE value ->> 'key' = '_ga_cid') as client_id,<br> COUNT(order_id) as orders,<br> SUM(total) as revenue<br> FROM raw_woocommerce_orders<br> WHERE status IN ('completed', 'processing', 'on-hold')<br> GROUP BY client_id<br> )<br> SELECT<br> cs.channel,<br> cs.campaign,<br> SUM(cs.sessions) as total_sessions,<br> COALESCE(SUM(co.orders), 0) as total_orders,<br> COALESCE(SUM(co.revenue), 0) as total_revenue,<br> CASE WHEN SUM(cs.sessions) > 0 THEN COALESCE(SUM(co.orders), 0)::float / SUM(cs.sessions) ELSE 0 END as conversion_rate<br> FROM channel_sessions cs<br> LEFT JOIN channel_orders co ON cs.client_id = co.client_id<br> GROUP BY cs.channel, cs.campaign<br> ORDER BY total_revenue DESC;<br>	视图 utm_funnel_performance_view 创建成功。查询该视图能返回按收入排序的、聚合好的各 UTM 渠道漏斗性能数据。
BE-1.3	☐	创建页面优化分析视图	1. 在 SQL Editor 中，编写并执行 SQL 创建一个视图，用于聚合每个页面的流量、参与度和转化行为。<br> sql<br> CREATE OR REPLACE VIEW page_optimization_view AS<br> SELECT<br> (page_data ->> 'pagePath') AS page_path,<br> (page_data ->> 'deviceCategory') AS device,<br> SUM((page_data ->> 'sessions')::int) AS total_sessions,<br> AVG((page_data ->> 'averageSessionDuration')::float) AS avg_session_duration,<br> AVG((page_data ->> 'bounceRate')::float) AS bounce_rate,<br> SUM((page_data ->> 'addToCarts')::int) AS total_add_to_carts,<br> SUM((page_data ->> 'checkouts')::int) AS total_checkouts<br> FROM raw_ga4_page_behavior -- 使用页面行为数据集<br> GROUP BY page_path, device<br> ORDER BY total_sessions DESC;<br>	视图 page_optimization_view 创建成功。查询该视图能返回每个页面的详细用户行为指标。
BE-1.4	☐	为所有对象配置 RLS	1. 确认表 RLS: 确保所有 raw_... 表和 insights, recommendations 表已开启 RLS。<br>2. 为视图开启 RLS: 进入 Authentication -> Policies，为所有新创建的视图（daily_kpi..., utm_funnel..., page_optimization...）启用 RLS。<br>3. 创建读取策略: 为每个视图创建一个新策略，选择 "Enable read access for authenticated users"。	RLS 已在所有表和视图上开启。前端应用可以通过用户身份安全地查询这些分析视图，但无法直接修改原始数据。
第二阶段：数据同步层 - 构建自动化的数据管道 (预计 2 天)
目标： 构建并部署一个健壮的、可自动运行的、严格遵循“精要数据策略”的数据同步系统。
任务 ID	✅	任务描述	详细执行步骤与技术细节	验收标准
BE-2.1	☐	实现精要数据拉取函数	1. 创建 Edge Function: 在本地运行 supabase functions new sync-external-data。<br>2. 编写同步逻辑: 在 index.ts 中，编写代码连接 GSC, GA4, WooCommerce 等 API，并严格按照前置条件中定义的**“精要数据策略”**来拉取数据。<br> - GSC: 实现每日 Top 50 + 每周趋势数据的拉取逻辑。<br> - GA4: 实现拆分为“渠道效果”和“页面行为”两个独立数据集的拉取逻辑，并存入对应的 raw 表（可能需要新建 raw_ga4_channel_data 和 raw_ga4_page_behavior 表）。<br> - WooCommerce: 拉取所有订单。<br>3. 数据写入: 将所有拉取到的数据 upsert 到对应的 raw_... 表中。此函数不包含任何分析逻辑。	sync-external-data 函数在本地测试成功，能够将所有需要的精要数据正确写入数据库。
BE-2.2	☐	创建洞察保存函数	1. 创建 Edge Function: supabase functions new save-insight。<br>2. 编写写入逻辑: 这个函数非常简单。它接收前端传递过来的、已经由 AI 生成并由前端解析好的结构化 JSON 对象（包含 title, summary, recommendations）。<br>3. 安全写入: 函数内部使用 createClient (传入 service_role_key)，将数据安全地 insert 到 insights 和 recommendations 表中。必须要进行输入校验 (如 Zod)，确保传入的数据格式正确。<br> typescript<br> // supabase/functions/save-insight/index.ts (片段)<br> const { insight_title, insight_summary, recommendations } = await req.json();<br> // ... (Add Zod or basic validation here) ...<br> const { data: insight, error: insightError } = await supabaseAdmin.from('insights').insert({ title: insight_title, summary: insight_summary }).select().single();<br> // ... (Insert recommendations linked to insight.id) ...<br>	save-insight 函数能够安全地接收前端数据并将其写入数据库。
BE-2.3	☐	部署所有 Edge Functions	1. 本地测试通过后，运行 supabase functions deploy sync-external-data。<br>2. 运行 supabase functions deploy save-insight。<br>3. 登录 Supabase Studio，在 Edge Functions 菜单下确认两个函数都已激活。	所有后端逻辑的载体——Edge Functions——都已成功部署到云端并处于待命状态。
第三阶段：自动化调度 - 让系统“活”起来 (预计 0.5 天)
目标： 设置定时任务，让数据同步流程能够定期、自动地运行，无需任何人工干预。
任务 ID	✅	任务描述	详细执行步骤与代码/配置示例	验收标准
BE-3.1	☐	启用并配置 pg_cron	1. 启用扩展: 在 Supabase Studio 中，进入 Database -> Extensions，在搜索框中输入 cron，并启用 pg_cron 扩展。<br>2. 创建调度任务: 进入 SQL Editor，运行以下命令来创建一个每天凌晨2点（UTC时间）运行的定时任务。<br> sql<br> -- Schedule a job to run every day at 2:00 AM UTC<br> SELECT cron.schedule(<br> 'daily-data-sync-job', -- Give the job a unique name<br> '0 2 * * *', -- Cron syntax for "at 2:00 AM every day"<br> $$<br> -- The command to run: invoke the Edge Function<br> SELECT net.http_post(<br> url:='https://<你的-project-ref>.supabase.co/functions/v1/sync-external-data',<br> headers:='{"Authorization": "Bearer <你的-service_role_key>"}'::jsonb<br> );<br> $$<br> );<br><br> 重要: 将 <...> 占位符替换为你自己的 project-ref 和 service_role_key。service_role_key 可以在 Settings -> API 中找到。	pg_cron 任务创建成功。你可以通过查询 cron.job 表看到你的任务。从第二天开始，raw_... 表的数据会自动更新，无需任何手动操作。
BE-3.2	☐	监控与日志	1. 函数日志: 定期检查 Supabase Studio 中 Edge Functions -> sync-external-data 的日志，确保定时任务每天都成功执行。<br>2. 设置告警 (可选): (高级) 可以创建一个额外的 Edge Function，它每天检查 raw_... 表的最新 synced_at 时间戳。如果时间戳不是当天，就通过 webhook (如 Slack 或 Discord) 发送告警。	你有了一套可以监控自动化任务是否健康运行的机制。
后端工作总结
完成以上所有任务后，你的后端系统将达到一个高度自动化、职责清晰且性能卓越的状态：
数据管道 (Pipeline): pg_cron -> sync-external-data -> raw_... 表。完全自动化。
数据建模 (Modeling): raw_... 表 -> SQL 视图。实时、自动。
AI 分析 (Analysis): 由前端按需触发，查询的是预处理好的视图，实时性强。
洞察存储 (Storage): 由前端通过 save-insight 函数按需写入。
这个后端架构既健壮又灵活，完美地支撑了前端的实时 AI 交互需求，同时保证了核心数据管道的自动化和可靠性。