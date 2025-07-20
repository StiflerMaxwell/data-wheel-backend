-- supabase/migrations/YYYYMMDDHHMMSS_create_pagespeed_reports_table.sql

CREATE TABLE pagespeed_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    page_url TEXT NOT NULL,
    strategy TEXT NOT NULL, -- 'mobile' or 'desktop'
    performance_score FLOAT,
    first_contentful_paint_ms INT,
    largest_contentful_paint_ms INT,
    cumulative_layout_shift FLOAT,
    total_blocking_time_ms INT,
    speed_index_ms INT,
    created_at TIMESTAMPTZ NOT-NULL DEFAULT NOW(),
    
    -- Ensure each report is unique for a given page, strategy, and date
    UNIQUE (report_date, page_url, strategy)
);

COMMENT ON TABLE pagespeed_reports IS 'Stores daily performance reports from Google PageSpeed Insights.';
COMMENT ON COLUMN pagespeed_reports.report_date IS 'The date the report was generated.';
COMMENT ON COLUMN pagespeed_reports.page_url IS 'The URL of the page that was analyzed.';
COMMENT ON COLUMN pagespeed_reports.strategy IS 'The strategy used for the analysis (mobile or desktop).';
COMMENT ON COLUMN pagespeed_reports.performance_score IS 'The overall performance score (0-1).';
COMMENT ON COLUMN pagespeed_reports.first_contentful_paint_ms IS 'Time to First Contentful Paint, in milliseconds.';
COMMENT ON COLUMN pagespeed_reports.largest_contentful_paint_ms IS 'Time to Largest Contentful Paint, in milliseconds.';
COMMENT ON COLUMN pagespeed_reports.cumulative_layout_shift IS 'Cumulative Layout Shift score.';
COMMENT ON COLUMN pagespeed_reports.total_blocking_time_ms IS 'Total Blocking Time, in milliseconds.';
COMMENT ON COLUMN pagespeed_reports.speed_index_ms IS 'Speed Index, in milliseconds.'; 