/**
 * 一个简单的测试函数，用于检查环境变量是否正确设置
 */

import { serve, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 检查关键环境变量是否存在（不返回实际值，只返回状态）
    const envStatus = {
      // Supabase 配置
      SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      
      // GA4 配置
      GA4_PROPERTY_ID: !!Deno.env.get('GA4_PROPERTY_ID'),
      GA4_GSC_SERVICE_ACCOUNT_KEY: !!Deno.env.get('GA4_GSC_SERVICE_ACCOUNT_KEY'),
      
      // WooCommerce 配置
      WOO_URL: !!Deno.env.get('WOO_URL'),
      WOO_KEY: !!Deno.env.get('WOO_KEY'),
      WOO_SECRET: !!Deno.env.get('WOO_SECRET'),
    };
    
    return new Response(JSON.stringify({
      message: '环境变量状态检查',
      envStatus,
      denoVersion: Deno.version,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 