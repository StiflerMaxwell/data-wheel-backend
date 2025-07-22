import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req: Request) => {
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // 解析请求参数
    const { insightId } = await req.json();
    
    // 验证必要的参数
    if (!insightId) {
      return new Response(
        JSON.stringify({ error: 'insightId 参数是必需的' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 创建Supabase客户端
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 获取洞察数据及其建议
    const { data: insightData, error: insightError } = await supabaseClient
      .from('insights')
      .select(`*, recommendations (id, description, status, assignee_id, due_date, feedback)`)
      .eq('id', insightId)
      .single();
    
    if (insightError) {
      console.error('获取洞察数据时出错:', insightError);
      throw insightError;
    }
    
    if (!insightData) {
  return new Response(
        JSON.stringify({ error: '未找到指定的洞察' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 获取上下文数据（最近7天的每日摘要）
    const { data: contextData, error: contextError } = await supabaseClient
      .from('daily_summary')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);
    
    if (contextError) {
      console.error('获取上下文数据时出错:', contextError);
      throw contextError;
    }
    
    // 获取分配的用户信息
    let assignedUsers = {};
    if (insightData.recommendations && insightData.recommendations.length > 0) {
      const assigneeIds = insightData.recommendations.filter(rec => rec.assignee_id).map(rec => rec.assignee_id);
      
      if (assigneeIds.length > 0) {
        const { data: usersData, error: usersError } = await supabaseClient
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', assigneeIds);
        
        if (!usersError && usersData) {
          assignedUsers = Object.fromEntries(usersData.map(user => [user.id, user]));
        } else {
          console.error('获取用户数据时出错:', usersError);
        }
      }
    }
    
    // 构建响应数据
    const responsePayload = {
      insight: insightData,
      context_data: contextData || [],
      assigned_users: assignedUsers
    };
    
    // 返回响应
    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('处理请求时出错:', error);
    
    // 返回错误信息
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
