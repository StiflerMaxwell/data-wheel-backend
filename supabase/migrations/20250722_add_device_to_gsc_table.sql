-- supabase/migrations/20250722_add_device_to_gsc_table.sql
-- 目标：为 raw_gsc_data 表添加 device 列，并更新唯一约束，以支持更精细的GSC数据分析。

-- 步骤1: 如果 device 列不存在，则添加它
ALTER TABLE public.raw_gsc_data
ADD COLUMN IF NOT EXISTS device TEXT;

-- 步骤2: 移除旧的唯一约束（如果存在）
-- 使用 DO $$...$$ 块来安全地执行，即使约束不存在也不会报错
DO $$
BEGIN
   IF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'raw_gsc_data_unique_row' AND conrelid = 'public.raw_gsc_data'::regclass
   ) THEN
       ALTER TABLE public.raw_gsc_data DROP CONSTRAINT raw_gsc_data_unique_row;
   END IF;
END;
$$;

-- 步骤3: 添加包含 device 列的新的复合唯一约束
-- 同样，先检查约束是否存在，避免重复执行
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'raw_gsc_data_unique_row_with_device' AND conrelid = 'public.raw_gsc_data'::regclass
   ) THEN
       ALTER TABLE public.raw_gsc_data
       ADD CONSTRAINT raw_gsc_data_unique_row_with_device UNIQUE (date, page, query, device);
   END IF;
END;
$$;

-- 步骤4: 更新 saveGscDataToSupabase 函数中的 onConflict 参数
-- 这个步骤需要在你的代码中完成，将 onConflict 的值改为 'date,page,query,device'
-- 例如: .upsert(records, { onConflict: 'date,page,query,device' }); 