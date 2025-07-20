-- supabase/migrations/20250721_add_unique_constraint_to_ga4_table.sql
-- 为 raw_ga4_data 表添加一个复合唯一约束
-- 这个约束确保 (date, source, medium) 的组合在表中是唯一的，
-- 这是实现 UPSERT (ON CONFLICT) 功能所必需的。

-- 我们首先检查约束是否已存在，以避免重复执行此脚本时出错。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'raw_ga4_data_date_source_medium_key'
  ) THEN
    ALTER TABLE public.raw_ga4_data
    ADD CONSTRAINT raw_ga4_data_date_source_medium_key UNIQUE (date, source, medium);
  END IF;
END;
$$; 