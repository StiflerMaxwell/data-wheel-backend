-- supabase/migrations/20250722_create_gsc_table.sql
-- 创建 raw_gsc_data 表用于存储从 Google Search Console API 获取的原始数据。
-- 这张表的设计旨在捕捉网站在Google搜索中的表现，包括点击次数、展示次数、点击率(CTR)和平均排名。

CREATE TABLE IF NOT EXISTS public.raw_gsc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  page TEXT NOT NULL,
  query TEXT,
  clicks INTEGER,
  impressions INTEGER,
  ctr FLOAT,
  position FLOAT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 为了防止重复数据，我们为 (date, page, query) 的组合添加一个唯一约束。
  -- 这对于后续使用 ON CONFLICT (UPSERT) 功能至关重要。
  CONSTRAINT raw_gsc_data_unique_row UNIQUE (date, page, query)
);

-- 为常用查询字段添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_gsc_date ON public.raw_gsc_data(date);
CREATE INDEX IF NOT EXISTS idx_gsc_page_query ON public.raw_gsc_data(page, query);

-- 为表和列添加注释，以提高可读性和可维护性
COMMENT ON TABLE public.raw_gsc_data IS '存储从 Google Search Console API 获取的原始搜索分析数据';
COMMENT ON COLUMN public.raw_gsc_data.date IS '数据对应的日期';
COMMENT ON COLUMN public.raw_gsc_data.page IS '展示在搜索结果中的页面URL';
COMMENT ON COLUMN public.raw_gsc_data.query IS '用户在Google搜索中使用的查询词';
COMMENT ON COLUMN public.raw_gsc_data.clicks IS '该页面/查询组合获得的点击次数';
COMMENT ON COLUMN public.raw_gsc_data.impressions IS '该页面/查询组合获得的展示次数';
COMMENT ON COLUMN public.raw_gsc_data.ctr IS '点击率 (clicks / impressions)';
COMMENT ON COLUMN public.raw_gsc_data.position IS '在搜索结果中的平均排名';
COMMENT ON COLUMN public.raw_gsc_data.synced_at IS '记录同步到数据库的时间戳';

-- 启用行级安全 (RLS)，确保数据安全
ALTER TABLE public.raw_gsc_data ENABLE ROW LEVEL SECURITY; 