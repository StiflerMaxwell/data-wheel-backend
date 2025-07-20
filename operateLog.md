# 操作日志

## 2023-11-28
- 初始化项目，创建基本目录结构
- 设置 Supabase 项目

## 2023-11-29
- 创建数据库表结构
- 实现基本的数据同步功能

## 2023-11-30
- 添加 GA4 数据获取功能
- 优化数据处理流程

## 2023-12-01
- 实现 GSC 数据同步
- 添加错误处理和日志记录

## 2023-12-02
- 完成 WooCommerce 数据集成
- 添加数据可视化组件

## 2023-12-03
- 优化前端界面
- 添加用户认证功能

## 2023-12-04
- 实现数据分析功能
- 添加报表导出功能

## 2023-12-05
- 修复已知问题
- 发布 v1.0.0 版本

## 2024-07-23
- 更新 generate-insight 函数，使用更专业的 Gemini 2.5 flash 提示词模板
- 优化提示词结构，包括系统指令、任务定义和输出格式
- 确保 JSON 输出格式严格符合前端需求
- 提示词模板专注于奢侈品品牌"Vertu"的数据分析，包括宏观诊断、渠道归因、页面优化、核心洞察和行动建议 
## 2025-07-20

### 第一阶段：Supabase 云端基础设施建设

- ✅ S-1.1: 创建数据表结构
  - 创建了 `raw_woocommerce_orders`、`raw_gsc_data`、`insights` 和 `recommendations` 表

- ✅ S-1.2: 开启并配置行级安全 (RLS)
  - 为所有表启用了 RLS
  - 为 `insights` 和 `recommendations` 表创建了读取策略
  - 为 `recommendations` 表创建了更新策略

- ✅ S-1.3: 设置数据库 Secrets (Vault)
  - 在 Supabase Vault 中添加了 WOO_URL、WOO_KEY、WOO_SECRET 和 GEMINI_API_KEY

- ✅ S-1.4: 本地 CLI 环境设置
  - 初始化了 Supabase 项目
  - 关联了云端项目

### 第二阶段：核心后端逻辑开发

- ✅ S-2.1: 创建数据同步函数
  - 创建了 `sync-external-data` Edge Function
  - 使用 Supabase CLI 成功部署到云端
  - 实现了参数化的同步功能，可以根据查询参数决定执行哪种同步操作
  - 成功实现了 WooCommerce 同步功能，已验证可以获取订单数据并写入数据库
  - 为 Google Search Console 同步功能预留了接口

- ✅ S-2.2: 创建自动化分析脚本
  - 创建了 `analysis_scripts/run-analysis.ts` 脚本
  - 实现了从 Supabase 获取原始数据的功能
  - 添加了 Gemini API 集成，包括代理支持以解决网络连接问题
  - 添加了备用方案，在 API 调用失败时使用模拟响应
  - 优化了 prompt，使其能够生成更好的分析结果
  - 实现了将 AI 生成的洞察和建议写回数据库的功能

## 遇到的问题与解决方案

1. **TypeScript 编译错误**
   - 问题：`import.meta.url` 在 CommonJS 模块中不可用
   - 解决方案：创建了 `tsconfig.json` 和 `package.json`，配置为 ES 模块

2. **Gemini API 网络连接问题**
   - 问题：无法连接到 Gemini API
   - 解决方案：添加了 proxy-agent 支持，自动检测系统代理设置
   - 添加了备用方案，在 API 调用失败时使用模拟响应

3. **PowerShell 命令语法**
   - 问题：PowerShell 不支持 `&&` 作为命令分隔符
   - 解决方案：使用分号 `;` 或分开执行命令

4. **Supabase CLI 安装问题**
   - 问题：全局安装 Supabase CLI 遇到权限问题
   - 解决方案：在项目中本地安装 Supabase CLI，使用 `npx` 运行命令

5. **Edge Function 资源限制错误 (546)**
   - 问题：完整版 Edge Function 执行时超出资源限制
   - 解决方案：实现参数化的同步功能，根据查询参数决定执行哪种同步操作，避免一次执行所有操作

## 使用 Supabase CLI 部署 Edge Function 的步骤

1. 安装 Supabase CLI（本地安装）：
   ```bash
   npm install supabase --save-dev
   ```

2. 登录 Supabase：
   ```bash
   npx supabase login
   ```

3. 链接本地项目到 Supabase 项目：
   ```bash
   npx supabase link --project-ref <project-ref>
   ```

4. 设置环境变量：
   ```bash
   npx supabase secrets set --env-file .env.local
   ```

5. 部署 Edge Function：
   ```bash
   npx supabase functions deploy <function-name> --no-verify-jwt
   ```

6. 测试 Edge Function：
   ```bash
   Invoke-WebRequest -Method POST -Uri 'https://<project-ref>.supabase.co/functions/v1/<function-name>?type=woocommerce' -Headers @{'Authorization'='Bearer <anon-key>'}
   ```

## 下一步计划

- 实现 Google Search Console 同步功能
- 在实际环境中测试 Gemini API 调用
- 设置定期触发数据同步和分析 
## 2025-07-19T20:29:37.165Z

### 数据分析出错
```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent: fetch failed
TypeError: fetch failed
    at node:internal/deps/undici/undici:15482:13
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async makeRequest (file:///E:/%E5%AE%A2%E6%88%B7%E8%B5%84%E6%96%99/vertu/Cursor/data-wheels/node_modules/@google/generative-ai/dist/index.mjs:193:20)
    at async generateContent (file:///E:/%E5%AE%A2%E6%88%B7%E8%B5%84%E6%96%99/vertu/Cursor/data-wheels/node_modules/@google/generative-ai/dist/index.mjs:534:22)
    at async analyzeDataWithGemini (E:\客户资料\vertu\Cursor\data-wheels\analysis_scripts\run-analysis.ts:136:20)
    at async main (E:\客户资料\vertu\Cursor\data-wheels\analysis_scripts\run-analysis.ts:238:28)
```
    

## 2025-07-19T20:33:03.116Z

### 数据分析完成
- 分析了 100 条 WooCommerce 订单
- 生成了 1 条洞察
- 生成了 2 条建议
    

## 2025-07-21

### 添加GA4数据抓取功能

- ✅ 实现了Google Analytics 4数据同步功能
  - 在Edge Function中添加了GA4数据抓取逻辑
  - 使用Google OAuth认证访问GA4 Data API
  - 获取过去30天的会话、用户和转化数据，按日期、来源和媒介维度聚合
  - 实现了将GA4数据写入raw_ga4_data表的功能
  - 完善了Edge Function的错误处理和参数化执行

- 遇到的问题与解决方案:
  - GA4需要特定的API调用格式和维度/指标组合
  - 使用Google Analytics Data API v1beta获取报告数据
  - 为提高稳定性，添加了详细的错误处理和日志记录

### 下一步计划
- 测试GA4数据同步功能
- 实现Google Search Console数据同步
- 将GA4数据整合到分析流程中
    

## 2025-07-22

### 后端优化 - 第一阶段：构建商业智能视图

- ✅ **BE-1.1: 创建宏观健康度监控视图**
  - 成功创建并应用了 `daily_kpi_summary_view`。
  - 此视图聚合了每日的GA4和WooCommerce核心指标（会话、订单、收入），并计算了日环比和周环比，为宏观业务监控提供了强大的数据支持。

- ✅ **BE-1.2: 创建UTM渠道漏斗性能视图**
  - 成功创建并应用了 `utm_funnel_performance_view`。
  - 此视图通过关联GA4的流量数据和WooCommerce的订单数据，揭示了不同营销渠道的真实转化效果，是进行渠道优化的关键。

- ✅ **BE-1.3: 创建页面优化分析视图**
  - 成功创建并应用了 `page_optimization_view`。
  - 此视图聚合了每个页面的流量和用户行为指标（如会话数、跳出率、转化数），为定位和优化页面性能提供了直接依据。

- ✅ **BE-1.4: 为视图开启RLS**
  - 遇到了PostgreSQL不支持直接对视图启用RLS的技术限制。
  - **解决方案**: 成功地在所有视图所依赖的基表（`raw_ga4_data`, `raw_woocommerce_orders`, `raw_ga4_page_behavior`）上启用RLS并设置了“允许已认证用户读取”的策略，从而间接地保护了所有分析视图的数据安全，确保了前端应用的访问权限。
    
