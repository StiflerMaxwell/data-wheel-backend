# 数据分析平台 - 后续工作计划 (v1.0)

本文档基于 `dev.md` (v4.3) 的任务清单，整理了从第三阶段“提升至生产级可靠性”开始的所有剩余工作。

---

### **阶段三：提升至生产级可靠性 (Production-Grade Reliability)**

此阶段的目标是将系统从“功能可用”提升到“健壮可靠”，确保其能够长期、稳定、自动化地运行。

| 任务 ID | ✅ | 任务描述 | 建议的执行步骤与说明 |
| :--- | :---: | :--- | :--- |
| **BE-2.3** | ☐ | **部署已升级的 `save-insight` 函数** | 我们已经为 `save-insight` 函数编写了包含 Zod 输入校验的代码，但尚未部署。**这是进入第三阶段前的首要任务。**<br>1. 在终端运行: `npx supabase functions deploy save-insight` |
| **BE-3.2** | ☐ | **为核心 Edge Functions 编写单元测试** | 为 `sync-external-data`, `generate-insight`, 和 `save-insight` 这三个核心函数编写单元测试，是保障代码质量和未来重构安全性的关键。<br>1. **测试框架**: 使用 Deno 内置的测试运行器。<br>2. **创建测试文件**: 在每个函数目录下创建 `_test.ts` 文件。<br>3. **编写测试用例**: 使用 `stub` 和 `mock` 模拟 Supabase 客户端和外部 API (如 Gemini, fetch) 的行为，专注于测试函数的内部逻辑，而非外部依赖。 |
| **BE-3.3** | ☐ | **建立数据库迁移与版本控制的最佳实践** | 确保所有数据库的结构变更（如新建表、修改视图）都通过版本化的 SQL 迁移文件进行管理。<br>1. **本地开发**: 在本地 Supabase 环境中测试 SQL 变更。<br>2. **生成迁移文件**: 运行 `supabase db diff -f <migration_name>` 自动生成记录变更的 SQL 文件。<br>3. **提交到 Git**: 将 `supabase/migrations/` 目录下的文件提交到版本控制。<br>4. **部署到生产**: 通过 CI/CD 自动运行 `supabase db push` 或在 Supabase Studio 中手动执行 SQL。 |
| **BE-3.4** | ☐ | **(可选) 建立 CI/CD 自动化流水线** | 使用 GitHub Actions 或类似工具，实现当代码推送到 `main` 分支时，自动测试并部署 Edge Functions。<br>1. **创建工作流**: 在 `.github/workflows/` 目录下创建 `supabase.yml` 文件。<br>2. **定义触发器**: 设置在 `supabase/functions/**` 路径有变更时触发。<br>3. **配置部署步骤**: 使用 `supabase/setup-cli` Action，并运行 `supabase functions deploy`。 |
| **BE-3.5** | ☐ | **建立基础的监控与告警机制** | 主动监控系统健康状况，而非被动等待用户报告问题。<br>1. **日志监控**: 定期检查 Supabase Studio 中 `pg_cron` 任务 (`daily-data-sync-job`) 的执行日志，确保每日同步成功。<br>2. **性能监控**: 在 Supabase 控制台的 `Reports -> Database Health` 中关注 CPU、RAM 和磁盘 I/O 指标，及时发现性能瓶颈。<br>3. **设置告警**: 在 `Logs` 页面，针对 `level = "error"` 的查询创建 "Log Alert"，当系统出现严重错误时，通过邮件或 Webhook 接收实时通知。|

---

完成以上所有任务后，整个后端系统将具备高度的自动化、可测试性和可维护性，达到生产环境的交付标准。 