import { serve, corsHeaders } from '../_shared/deps.ts';

/**
 * 检查环境变量的格式
 * @param envVar 环境变量名称
 * @param value 环境变量值
 * @returns 检查结果
 */
function checkFormat(envVar: string, value: string): Record<string, boolean | string> {
  if (envVar.includes('PRIVATE_KEY')) {
    return {
      hasQuotes: value.startsWith('"') && value.endsWith('"'),
      hasEscapedNewlines: value.includes('\\n'),
      hasBeginMarker: value.includes('-----BEGIN PRIVATE KEY-----'),
      hasEndMarker: value.includes('-----END PRIVATE KEY-----'),
      recommendation: !value.includes('-----BEGIN PRIVATE KEY-----') ? 
        '私钥格式不正确，缺少 BEGIN PRIVATE KEY 标记' : 
        (value.includes('\\n') ? '私钥包含转义换行符，可能需要处理' : 'OK'),
    };
  } else if (envVar.includes('SERVICE_ACCOUNT_KEY')) {
    try {
      const parsed = JSON.parse(value);
      return {
        isValidJson: true,
        hasRequiredFields: !!(parsed.client_email && parsed.private_key),
        recommendation: (!parsed.client_email || !parsed.private_key) ? 
          '缺少必需的字段 (client_email 或 private_key)' : 'OK',
      };
    } catch (e) {
      return {
        isValidJson: false,
        recommendation: '无效的 JSON 格式',
      };
    }
  }
  
  return { format: 'OK' };
}

serve(async (req: Request) => {
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { check } = await req.json();
    
    if (!check || !Array.isArray(check)) {
      return new Response(JSON.stringify({ error: '请提供要检查的环境变量数组' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    const result: Record<string, any> = {};
    
    for (const envVar of check) {
      // @ts-ignore
      const value = Deno.env.get(envVar);
      
      result[envVar] = {
        exists: !!value,
        length: value ? value.length : 0,
        format: value ? checkFormat(envVar, value) : null,
    };
    }
    
    return new Response(JSON.stringify({
      success: true, 
      result,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('处理环境变量检查请求时出错:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '处理请求时发生未知错误' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 