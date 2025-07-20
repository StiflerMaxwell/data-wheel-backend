-- supabase/migrations/YYYYMMDDHHMMSS_create_clarity_metrics_table.sql

CREATE TABLE clarity_metrics (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    page_url TEXT NOT NULL,
    dead_clicks INT,
    rage_clicks INT,
    excessive_scrolling INT,
    average_scroll_depth_percent FLOAT,
    created_at TIMESTAMPTZ NOT-NULL DEFAULT NOW(),
    
    -- Ensure each metric is unique for a given page and date
    UNIQUE (metric_date, page_url)
);

COMMENT ON TABLE clarity_metrics IS 'Stores daily user behavior metrics from Microsoft Clarity.';
COMMENT ON COLUMN clarity_metrics.metric_date IS 'The date the metrics were recorded.';
COMMENT ON COLUMN clarity_metrics.page_url IS 'The URL of the page where metrics were collected.';
COMMENT ON COLUMN clarity_metrics.dead_clicks IS 'Number of clicks that had no effect.';
COMMENT ON COLUMN clarity_metrics.rage_clicks IS 'Number of rapid clicks in the same area, indicating user frustration.';
COMMENT ON COLUMN clarity_metrics.excessive_scrolling IS 'Instances of users scrolling up and down repeatedly.';
COMMENT ON COLUMN clarity_metrics.average_scroll_depth_percent IS 'The average percentage of the page height users scrolled to.'; 