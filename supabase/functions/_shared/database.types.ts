// supabase/functions/_shared/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      raw_woocommerce_orders: {
        Row: {
          order_id: number;
          order_data: Json;
          created_at: string;
        };
        Insert: {
          order_id: number;
          order_data: Json;
          created_at?: string;
        };
        Update: {
          order_id?: number;
          order_data?: Json;
          created_at?: string;
        };
      };
      raw_gsc_data: {
        Row: {
          id: string;
          date: string;
          query: string | null;
          page: string | null;
          clicks: number | null;
          impressions: number | null;
          ctr: number | null;
          position: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          query?: string | null;
          page?: string | null;
          clicks?: number | null;
          impressions?: number | null;
          ctr?: number | null;
          position?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          query?: string | null;
          page?: string | null;
          clicks?: number | null;
          impressions?: number | null;
          ctr?: number | null;
          position?: number | null;
          created_at?: string;
        };
      };
      insights: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          summary: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          summary?: string;
          created_at?: string;
        };
      };
      recommendations: {
        Row: {
          id: string;
          insight_id: string;
          description: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          insight_id: string;
          description: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          insight_id?: string;
          description?: string;
          status?: string;
          created_at?: string;
        };
      };
      pagespeed_reports: {
        Row: {
          id: number;
          report_date: string;
          page_url: string;
          strategy: string;
          performance_score: number | null;
          first_contentful_paint_ms: number | null;
          largest_contentful_paint_ms: number | null;
          cumulative_layout_shift: number | null;
          total_blocking_time_ms: number | null;
          speed_index_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          report_date?: string;
          page_url: string;
          strategy: string;
          performance_score?: number | null;
          first_contentful_paint_ms?: number | null;
          largest_contentful_paint_ms?: number | null;
          cumulative_layout_shift?: number | null;
          total_blocking_time_ms?: number | null;
          speed_index_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          report_date?: string;
          page_url?: string;
          strategy?: string;
          performance_score?: number | null;
          first_contentful_paint_ms?: number | null;
          largest_contentful_paint_ms?: number | null;
          cumulative_layout_shift?: number | null;
          total_blocking_time_ms?: number | null;
          speed_index_ms?: number | null;
          created_at?: string;
        };
      };
      clarity_metrics: {
        Row: {
          id: number;
          metric_date: string;
          page_url: string;
          dead_clicks: number | null;
          rage_clicks: number | null;
          excessive_scrolling: number | null;
          average_scroll_depth_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          metric_date?: string;
          page_url: string;
          dead_clicks?: number | null;
          rage_clicks?: number | null;
          excessive_scrolling?: number | null;
          average_scroll_depth_percent?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          metric_date?: string;
          page_url?: string;
          dead_clicks?: number | null;
          rage_clicks?: number | null;
          excessive_scrolling?: number | null;
          average_scroll_depth_percent?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
} 