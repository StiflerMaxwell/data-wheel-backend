-- 删除 2025-07-01 日期的 GSC 测试数据
DELETE FROM public.raw_gsc_data
WHERE date = '2025-07-01';

-- 添加删除记录到日志表（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_logs') THEN
        INSERT INTO public.system_logs (operation, description, performed_by)
        VALUES ('delete', '删除了 raw_gsc_data 表中 2025-07-01 的 7977 条测试数据', 'system');
    END IF;
END $$; 