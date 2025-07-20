-- 创建 GA4 数据表的存储过程
CREATE OR REPLACE FUNCTION create_ga4_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 检查表是否存在
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'raw_ga4_data'
  ) THEN
    -- 创建表
    CREATE TABLE public.raw_ga4_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      source TEXT,
      medium TEXT,
      sessions INTEGER,
      total_users INTEGER,
      new_users INTEGER,
      conversions INTEGER,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 添加注释
    COMMENT ON TABLE public.raw_ga4_data IS '存储从 Google Analytics 4 API 获取的原始分析数据';
    
    -- 启用行级安全策略
    ALTER TABLE public.raw_ga4_data ENABLE ROW LEVEL SECURITY;
    
    -- 创建索引
    CREATE INDEX idx_ga4_date ON public.raw_ga4_data(date);
    CREATE INDEX idx_ga4_source_medium ON public.raw_ga4_data(source, medium);
  END IF;
END;
$$; 