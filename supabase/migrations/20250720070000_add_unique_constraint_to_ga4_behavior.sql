ALTER TABLE public.raw_ga4_page_behavior
ADD CONSTRAINT raw_ga4_page_behavior_unique_row
UNIQUE (date, page_path, device_category); 