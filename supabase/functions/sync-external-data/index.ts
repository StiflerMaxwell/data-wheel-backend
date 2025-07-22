import {
  serve,
  createClient,
  GoogleAuth,
  corsHeaders,
} from '../_shared/deps.ts';

// Main token acquisition function based on the user's best practice
async function getGoogleAccessToken(scopes: string[]) {
  try {
    // 1. 首先尝试从环境变量获取完整的服务账号 JSON
  // @ts-ignore
    const serviceAccountJsonEnv = Deno.env.get("GA4_GSC_SERVICE_ACCOUNT_KEY");
    let serviceAccountJson: any = null;
    
    // 检查是否有 JSON 文件路径
    // @ts-ignore
    const serviceAccountFilePath = Deno.env.get("GA4_GSC_SERVICE_ACCOUNT_FILE");
    
    if (serviceAccountJsonEnv) {
      console.log("使用环境变量中的完整服务账户 JSON");
      try {
        serviceAccountJson = JSON.parse(serviceAccountJsonEnv);
      } catch (parseError) {
        console.error('解析服务账户 JSON 时出错:', parseError);
        console.error('服务账户 JSON 前 100 个字符:', serviceAccountJsonEnv.substring(0, 100));
      }
    } else if (serviceAccountFilePath) {
      try {
        console.log(`尝试从文件加载服务账户 JSON: ${serviceAccountFilePath}`);
        // @ts-ignore
        const fileContent = await Deno.readTextFile(serviceAccountFilePath);
        serviceAccountJson = JSON.parse(fileContent);
      } catch (fileError) {
        console.error('从文件加载服务账户 JSON 时出错:', fileError);
      }
  }
  
    // 2. 如果有可用的服务账户 JSON，尝试使用它进行认证
    if (serviceAccountJson && serviceAccountJson.client_email && serviceAccountJson.private_key) {
      try {
        // 详细的诊断日志
        console.log('使用完整 JSON 凭据进行认证:');
        console.log(`- Client Email: ${serviceAccountJson.client_email}`);
        console.log(`- Project ID: ${serviceAccountJson.project_id || 'N/A'}`);
        console.log(`- Private Key ID: ${serviceAccountJson.private_key_id || 'N/A'}`);
        console.log(`- Private Key 存在: ${!!serviceAccountJson.private_key}`);
        console.log(`- Private Key 前 30 个字符: ${serviceAccountJson.private_key.substring(0, 30)}`);
        console.log(`- 当前服务器时间: ${new Date().toISOString()}`);
        
        const auth = new GoogleAuth({
          credentials: serviceAccountJson,
          scopes,
        });
        
        const accessToken = await auth.getAccessToken();
        if (!accessToken) {
          throw new Error('使用 JSON 凭据获取访问令牌失败');
        }
        console.log(`成功使用完整服务账户 JSON 获取访问令牌。令牌长度: ${accessToken.length}`);
        return accessToken;
      } catch (authError) {
        console.error('使用完整 JSON 凭据认证时出错:', authError);
        console.error('认证错误详情:', JSON.stringify(authError, null, 2));
        console.log('尝试使用单独的凭据...');
      }
    } else {
      console.log("未找到有效的完整服务账户 JSON，尝试使用单独的凭据...");
    }
    
    // 3. 如果没有完整的 JSON 或认证失败，根据 scope 使用单独的环境变量
    let serviceAccountEmail = '';
    let serviceAccountPrivateKey = '';
    
    if (scopes.includes('https://www.googleapis.com/auth/analytics.readonly')) {
      // 使用 GA4 的服务账号
      // @ts-ignore
      serviceAccountEmail = Deno.env.get("GA_SERVICE_ACCOUNT_EMAIL") || '';
      // @ts-ignore
      serviceAccountPrivateKey = Deno.env.get("GA_SERVICE_ACCOUNT_PRIVATE_KEY") || '';
      console.log("使用 GA4 服务账户凭据");
      
      // 检查凭据是否存在
      if (!serviceAccountEmail) console.error("GA_SERVICE_ACCOUNT_EMAIL 未设置或为空");
      if (!serviceAccountPrivateKey) console.error("GA_SERVICE_ACCOUNT_PRIVATE_KEY 未设置或为空");
    } else if (scopes.includes('https://www.googleapis.com/auth/webmasters.readonly')) {
      // 使用 GSC 的服务账号
      // @ts-ignore
      serviceAccountEmail = Deno.env.get("GSC_SERVICE_ACCOUNT_EMAIL") || '';
      // @ts-ignore
      serviceAccountPrivateKey = Deno.env.get("GSC_SERVICE_ACCOUNT_PRIVATE_KEY") || '';
      console.log("使用 GSC 服务账户凭据");
      
      // 检查凭据是否存在
      if (!serviceAccountEmail) console.error("GSC_SERVICE_ACCOUNT_EMAIL 未设置或为空");
      if (!serviceAccountPrivateKey) console.error("GSC_SERVICE_ACCOUNT_PRIVATE_KEY 未设置或为空");
    } else {
      throw new Error("不支持的 Google 认证范围");
    }
    
    // 检查凭据是否存在
    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      throw new Error("环境变量中未找到服务账户凭据");
    }

    // 4. 处理私钥格式
  // --- 诊断日志 ---
    console.log('使用单独凭据进行认证:');
    console.log(`- Client Email: ${serviceAccountEmail}`);
    console.log(`- Private Key 格式检查: ${serviceAccountPrivateKey.includes("-----BEGIN PRIVATE KEY-----") ? "OK" : "无效"}`);
    console.log(`- Private Key 前 20 个字符: ${serviceAccountPrivateKey.substring(0, 20)}`);
    console.log(`- Private Key 后 20 个字符: ${serviceAccountPrivateKey.slice(-20)}`);
    console.log(`- 当前服务器时间: ${new Date().toISOString()}`);
    // --- 结束诊断日志 ---

    // 尝试修复可能的私钥格式问题
    let fixedPrivateKey = serviceAccountPrivateKey;
    
    // 处理引号问题
    if (fixedPrivateKey.startsWith('"') && fixedPrivateKey.endsWith('"')) {
      console.log("移除私钥周围的引号");
      fixedPrivateKey = fixedPrivateKey.slice(1, -1);
    }
    
    // 处理换行符问题
    if (fixedPrivateKey.includes('\\n')) {
      console.log("替换私钥中的转义换行符");
      fixedPrivateKey = fixedPrivateKey.replace(/\\n/g, '\n');
    }
    
    // 检查修复后的私钥格式
    const isValidFormat = fixedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") && 
                          fixedPrivateKey.includes("-----END PRIVATE KEY-----");
    
    console.log(`- 修复后的私钥格式检查: ${isValidFormat ? "OK" : "无效"}`);
    console.log(`- 修复后的私钥前 30 个字符: ${fixedPrivateKey.substring(0, 30)}`);
    
    if (!isValidFormat) {
      console.error("私钥格式无效，即使经过修复后仍然缺少必要的标记");
      throw new Error("私钥格式无效，缺少 BEGIN/END PRIVATE KEY 标记");
    }
    
    // 5. 使用修复后的凭据进行认证
    try {
      const auth = new GoogleAuth({
        credentials: {
          client_email: serviceAccountEmail,
          private_key: fixedPrivateKey,
        },
        scopes,
      });
      
      const accessToken = await auth.getAccessToken();
      if (!accessToken) {
        throw new Error('使用单独凭据获取访问令牌失败');
      }
      console.log(`成功使用单独凭据获取访问令牌。令牌长度: ${accessToken.length}`);
      return accessToken;
    } catch (authError: any) {
      console.error('使用单独凭据认证时出错:', authError);
      // 详细的错误信息
      if (authError.message) console.error('错误消息:', authError.message);
      if (authError.stack) console.error('错误堆栈:', authError.stack);
      throw new Error(`Google 认证失败: ${authError.message || '未知错误'}`);
    }
  } catch (error: any) {
    // 增强错误处理，提供更多上下文
    console.error('认证错误详情:', error);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    throw new Error(`获取访问令牌失败: ${error.message || error}`);
  }
}

// 备份当前的 getGoogleAccessToken 函数
async function getGoogleAccessToken_backup(scopes: string[]) {
  try {
    // 1. 首先尝试从环境变量获取完整的服务账号 JSON
    // @ts-ignore
    const serviceAccountJson = Deno.env.get("GA4_GSC_SERVICE_ACCOUNT_KEY");
    
    if (serviceAccountJson) {
      console.log("Using complete service account JSON from environment variable");
      
      try {
        // 解析 JSON 字符串为对象
        const credentials = JSON.parse(serviceAccountJson);
        
        // --- 诊断日志 ---
        console.log('Attempting to authenticate with JSON credentials:');
  console.log(`- Client Email: ${credentials.client_email}`);
        console.log(`- Project ID: ${credentials.project_id}`);
        console.log(`- Private Key ID: ${credentials.private_key_id}`);
        console.log(`- Private Key exists: ${!!credentials.private_key}`);
        console.log(`- Private Key first 30 chars: ${credentials.private_key.substring(0, 30)}`);
        console.log(`- Current server time: ${new Date().toISOString()}`);
  // --- 结束诊断日志 ---

        // 使用完整的服务账号 JSON 进行认证
        const auth = new GoogleAuth({
          credentials,
          scopes,
        });
        
        const accessToken = await auth.getAccessToken();
        if (!accessToken) {
          throw new Error('Failed to get access token from GoogleAuth using JSON credentials');
        }
        console.log(`Successfully obtained access token using complete service account JSON. Token length: ${accessToken.length}`);
        return accessToken;
      } catch (parseError) {
        console.error('Error parsing service account JSON:', parseError);
        console.error('Service account JSON first 100 chars:', serviceAccountJson.substring(0, 100));
        console.log('Falling back to environment variables for service account credentials');
        
        // 从环境变量获取服务账号配置，而不是使用硬编码凭据
        // @ts-ignore
        const fallbackServiceAccountEmail = Deno.env.get("FALLBACK_SERVICE_ACCOUNT_EMAIL");
        // @ts-ignore
        const fallbackServiceAccountPrivateKey = Deno.env.get("FALLBACK_SERVICE_ACCOUNT_PRIVATE_KEY");
        
        if (!fallbackServiceAccountEmail || !fallbackServiceAccountPrivateKey) {
          console.error("Fallback service account credentials not found in environment variables");
          throw new Error("No valid service account credentials available");
        }
        
        let fixedPrivateKey = fallbackServiceAccountPrivateKey;
        
        // 处理引号问题
        if (fixedPrivateKey.startsWith('"') && fixedPrivateKey.endsWith('"')) {
          console.log("Removing surrounding quotes from private key");
          fixedPrivateKey = fixedPrivateKey.slice(1, -1);
        }
        
        // 处理换行符问题
        if (fixedPrivateKey.includes('\\n')) {
          console.log("Replacing escaped newlines in private key");
          fixedPrivateKey = fixedPrivateKey.replace(/\\n/g, '\n');
        }
        
        // 检查修复后的私钥格式
        if (!fixedPrivateKey.includes("-----BEGIN PRIVATE KEY-----")) {
          console.error("Fallback private key does not appear to be in the correct format");
          throw new Error("Invalid private key format");
        }
        
        // 使用环境变量中的服务账号配置
        const auth = new GoogleAuth({
          credentials: {
            client_email: fallbackServiceAccountEmail,
            private_key: fixedPrivateKey,
          },
          scopes,
        });
        
        const accessToken = await auth.getAccessToken();
        if (!accessToken) {
          throw new Error('Failed to get access token from GoogleAuth using fallback credentials');
        }
        console.log(`Successfully obtained access token using fallback credentials. Token length: ${accessToken.length}`);
        return accessToken;
      }
    } else {
      console.log("GA4_GSC_SERVICE_ACCOUNT_KEY not found, falling back to separate credentials");
    }
    
    // 2. 如果没有找到完整的 JSON，则根据 scope 使用分离的环境变量
    let serviceAccountEmail = '';
    let serviceAccountPrivateKey = '';
    
    if (scopes.includes('https://www.googleapis.com/auth/analytics.readonly')) {
      // 使用 GA4 的服务账号
      // @ts-ignore
      serviceAccountEmail = Deno.env.get("GA_SERVICE_ACCOUNT_EMAIL");
      // @ts-ignore
      serviceAccountPrivateKey = Deno.env.get("GA_SERVICE_ACCOUNT_PRIVATE_KEY");
      console.log("Using GA4 service account credentials from separate environment variables");
      
      // 检查凭据是否存在
      if (!serviceAccountEmail) console.error("GA_SERVICE_ACCOUNT_EMAIL is missing or empty");
      if (!serviceAccountPrivateKey) console.error("GA_SERVICE_ACCOUNT_PRIVATE_KEY is missing or empty");
      
      // 检查私钥格式
      if (serviceAccountPrivateKey && !serviceAccountPrivateKey.includes("-----BEGIN PRIVATE KEY-----")) {
        console.error("GA_SERVICE_ACCOUNT_PRIVATE_KEY does not appear to be in the correct format");
      }
    } else if (scopes.includes('https://www.googleapis.com/auth/webmasters.readonly')) {
      // 使用 GSC 的服务账号
      // @ts-ignore
      serviceAccountEmail = Deno.env.get("GSC_SERVICE_ACCOUNT_EMAIL");
      // @ts-ignore
      serviceAccountPrivateKey = Deno.env.get("GSC_SERVICE_ACCOUNT_PRIVATE_KEY");
      console.log("Using GSC service account credentials from separate environment variables");
      
      // 检查凭据是否存在
      if (!serviceAccountEmail) console.error("GSC_SERVICE_ACCOUNT_EMAIL is missing or empty");
      if (!serviceAccountPrivateKey) console.error("GSC_SERVICE_ACCOUNT_PRIVATE_KEY is missing or empty");
      
      // 检查私钥格式
      if (serviceAccountPrivateKey && !serviceAccountPrivateKey.includes("-----BEGIN PRIVATE KEY-----")) {
        console.error("GSC_SERVICE_ACCOUNT_PRIVATE_KEY does not appear to be in the correct format");
      }
    } else {
      throw new Error("Unsupported scope for Google authentication");
    }
    
    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      throw new Error("Service account credentials not found in environment variables");
    }

    // --- 诊断日志 ---
    console.log('Attempting to authenticate with separate credentials:');
    console.log(`- Client Email: ${serviceAccountEmail}`);
    console.log(`- Private Key format check: ${serviceAccountPrivateKey.includes("-----BEGIN PRIVATE KEY-----") ? "OK" : "INVALID"}`);
    console.log(`- Private Key first 20 chars: ${serviceAccountPrivateKey.substring(0, 20)}`);
    console.log(`- Private Key last 20 chars: ${serviceAccountPrivateKey.slice(-20)}`);
    console.log(`- Current server time: ${new Date().toISOString()}`);
    // --- 结束诊断日志 ---

    // 尝试修复可能的私钥格式问题
    let fixedPrivateKey = serviceAccountPrivateKey;
    
    // 处理引号问题
    if (fixedPrivateKey.startsWith('"') && fixedPrivateKey.endsWith('"')) {
      console.log("Removing surrounding quotes from private key");
      fixedPrivateKey = fixedPrivateKey.slice(1, -1);
    }
    
    // 处理换行符问题
    if (fixedPrivateKey.includes('\\n')) {
      console.log("Replacing escaped newlines in private key");
      fixedPrivateKey = fixedPrivateKey.replace(/\\n/g, '\n');
    }
    
    // 检查修复后的私钥格式
    console.log(`- Fixed Private Key format check: ${fixedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") ? "OK" : "INVALID"}`);
    console.log(`- Fixed Private Key first 30 chars: ${fixedPrivateKey.substring(0, 30)}`);
    
    // 使用服务账号凭据进行认证
  const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: fixedPrivateKey,
      },
      scopes,
  });

    try {
  const accessToken = await auth.getAccessToken();
  if (!accessToken) {
        throw new Error('Failed to get access token from GoogleAuth using separate credentials');
  }
      console.log(`Successfully obtained access token using separate credentials. Token length: ${accessToken.length}`);
  return accessToken;
    } catch (authError) {
      console.error('Authentication error with GoogleAuth:', authError);
      console.error('Auth error details:', JSON.stringify(authError));
      throw authError;
    }
  } catch (error) {
    // 增强错误处理，提供更多上下文
    console.error('Authentication error details:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`Failed to fetch access token: ${error.message || error}`);
  }
}

/**
 * 从WooCommerce获取订单数据
 * @param supabaseClient Supabase客户端实例
 * @returns 处理结果
 */
async function syncWooCommerceData(supabaseClient: any, startDate: string, endDate: string) {
  try {
    // 从环境变量获取WooCommerce API配置
    // @ts-ignore
    const wooUrl = Deno.env.get('WC_SITE_URL');
    // @ts-ignore
    const wooKey = Deno.env.get('WC_CONSUMER_KEY');
    // @ts-ignore
    const wooSecret = Deno.env.get('WC_CONSUMER_SECRET');
    
    if (!wooUrl || !wooKey || !wooSecret) {
      throw new Error('Missing WooCommerce API configuration');
    }

    // 使用传入的 startDate 和 endDate 参数，并确保其为完整的 ISO8601 格式
    const dateAfter = `${startDate}T00:00:00`;
    const dateBefore = `${endDate}T23:59:59`;
    
    console.log(`Fetching WooCommerce orders from ${dateAfter} to ${dateBefore}`);
    
    // 构建API URL，包含身份验证和日期范围过滤参数
    const apiUrl = `${wooUrl}/wp-json/wc/v3/orders?consumer_key=${wooKey}&consumer_secret=${wooSecret}&after=${dateAfter}&before=${dateBefore}&per_page=100`;
    
    // 发送API请求获取订单数据
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }
    
    const orders = await response.json();
    console.log(`Retrieved ${orders.length} orders from WooCommerce in date range ${startDate} to ${endDate}`);
    
    // 将订单数据写入数据库
    const results = [];
    for (const order of orders) {
      const { data, error } = await supabaseClient
        .from('raw_woocommerce_orders')
        .upsert({
          order_id: order.id.toString(),
          order_data: order,
          status: order.status, // 添加 status 字段，方便后续查询
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'order_id',
          returning: 'minimal'
        });
      
      if (error) {
        console.error(`Error storing order ${order.id}:`, error);
      } else {
        // @ts-ignore
        results.push(order.id);
      }
    }
    
    return {
      success: true,
      message: `Synced ${results.length} WooCommerce orders`,
      count: results.length,
    };
  } catch (error) {
    console.error('Error in syncWooCommerceData:', error);
    return {
      success: false,
      message: `Error syncing WooCommerce data: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * 从Google Analytics 4获取分析数据
 * @param supabaseClient Supabase客户端实例
 * @returns 处理结果
 */
async function syncGA4Data(supabaseClient: any, startDate: string, endDate: string) {
  try {
    // 获取Google OAuth访问令牌
    const accessToken = await getGoogleAccessToken([
      'https://www.googleapis.com/auth/analytics.readonly',
    ]);
    
    // 从环境变量获取GA4属性ID
    // @ts-ignore
    const propertyId = Deno.env.get('GA4_PROPERTY_ID');
    if (!propertyId) {
      throw new Error('Missing GA4_PROPERTY_ID in environment variables');
    }
    
    console.log(`Fetching GA4 data from ${startDate} to ${endDate}`);
    console.log("--- Executing Essential Data Strategy for GA4 (Channel Performance) ---");

    // 构建GA4 API请求体，严格遵循"精要数据策略"
    // 重要修改：使用日期维度来分解每天的数据，而不是只获取整个日期范围的聚合数据
    const requestBody = {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'date' }, // 添加日期维度，确保每天的数据都被获取
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' }, // 添加新用户指标
        { name: 'conversions' }
      ],
      limit: 10000, // 增加限制以确保获取整个日期范围的数据
    };
    
    // 发送GA4 Data API请求
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GA4 API error (${response.status}): ${errorText}`);
    }
    
    const reportData = await response.json();
    
    // 处理并保存GA4数据
    const rows = reportData.rows || [];
    console.log(`Retrieved ${rows.length} rows from GA4 for date range ${startDate} to ${endDate}`);
    
    if (rows.length === 0) {
      return {
        success: true,
        message: 'No new GA4 data to sync.',
        count: 0,
      };
    }

    // 1. 准备批量写入的数据
    const recordsToUpsert = rows.map((row: any) => {
      // 提取维度和指标值
      const [dateString, source, medium, campaign] = row.dimensionValues.map((dim: any) => dim.value);
      
      // 转换 GA4 日期格式 (YYYYMMDD) 为标准格式 (YYYY-MM-DD)
      const date = `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
      
      // 提取指标值并转换为数字
      const [sessions, totalUsers, newUsers, conversions] = row.metricValues.map((metric: any) => parseInt(metric.value, 10));
      
      return {
        date, // 使用每行数据中的日期，而不是固定使用 endDate
        source,
        medium,
        campaign,
        sessions,
        total_users: totalUsers,
        new_users: newUsers, // 添加新用户数据
        conversions,
        synced_at: new Date().toISOString()
      };
    });
    
    // 2. 执行一次性的批量写入操作
    const { error } = await supabaseClient
      .from('raw_ga4_data')
      .upsert(recordsToUpsert, {
        onConflict: 'date, source, medium, campaign', 
        returning: 'minimal'
      });
      
    if (error) {
      console.error(`Error during bulk upsert for GA4 data:`, error);
      throw error; // 抛出错误以便上层捕获
    }
    
    return {
      success: true,
      message: `Successfully synced ${recordsToUpsert.length} GA4 data entries.`,
      count: recordsToUpsert.length,
    };
  } catch (error) {
    console.error('Error in syncGA4Data:', error);
    return {
      success: false,
      message: `Error syncing GA4 data: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * 从Google Search Console获取搜索分析数据
 * @param supabaseClient Supabase客户端实例
 * @returns 处理结果
 */
async function syncGSCData(supabaseClient: any, startDate: string, endDate: string) {
  try {
    const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/webmasters.readonly']);
    // @ts-ignore
    const siteUrl = Deno.env.get('GSC_SITE_URL');
    if (!siteUrl) throw new Error('Missing GSC_SITE_URL in environment variables');

    // 辅助函数，用于按指定维度获取GSC数据
    const fetchGscData = async (dimensions: string[], limit: number) => {
        // GSC API不支持分页，因此我们一次性获取所有数据，但限制行数
        const requestBody = { startDate, endDate, dimensions, rowLimit: limit };
        console.log(`Fetching GSC data for dimensions [${dimensions.join(', ')}]... Limit: ${limit}`);
        
        const response = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GSC API error (${response.status}) for [${dimensions.join(', ')}]: ${errorText}`);
        }
        
        const reportData = await response.json();
        return reportData.rows || [];
    };

    // 1. 严格按照“精要数据策略”获取数据
    console.log("--- Executing Essential Data Strategy for GSC ---");
    const topQueriesData = await fetchGscData(['date', 'query'], 50);
    const topPagesData = await fetchGscData(['date', 'page'], 50);

    // 2. 合并并去重
    const combinedData = new Map<string, any>();

    const processRow = (row: any, type: 'query' | 'page') => {
      const date = row.keys[0];
      let query = type === 'query' ? row.keys[1] : null;
      let page = type === 'page' ? row.keys[1] : null;
      
      // 对于仅有page的数据，我们用页面路径作为临时的query key来确保唯一性
      const uniquePart = type === 'page' ? `page:${page}` : `query:${query}`;
      const key = `${date}|${uniquePart}`;
      
      if (!combinedData.has(key)) {
        combinedData.set(key, {
          date,
          page,
          query,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        });
      }
    };

    topQueriesData.forEach((row: any) => processRow(row, 'query'));
    topPagesData.forEach((row: any) => processRow(row, 'page'));

    const recordsToUpsert = Array.from(combinedData.values()).map(record => ({
      ...record,
      synced_at: new Date().toISOString()
    }));
    
    console.log(`Retrieved and combined a total of ${recordsToUpsert.length} unique rows from GSC.`);

    if (recordsToUpsert.length === 0) {
      return { success: true, message: 'No new GSC data to sync based on essential data strategy.', count: 0 };
    }

    // 3. 批量写入数据库
    const { error } = await supabaseClient
      .from('raw_gsc_data')
      .upsert(recordsToUpsert, { onConflict: 'date, page, query', returning: 'minimal' });
      
    if (error) {
      console.error(`Error during bulk upsert for GSC data:`, error);
      throw error;
    }

    return {
      success: true,
      message: `Successfully synced ${recordsToUpsert.length} GSC data entries based on essential data strategy.`,
      count: recordsToUpsert.length,
    };
  } catch (error) {
    console.error('Error in syncGSCData:', error);
    return {
      success: false,
      message: `Error syncing GSC data: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * 获取同步状态
 * @returns 同步状态信息
 */
async function getStatus() {
  return {
    status: 'online',
    version: '1.1.0',
    availableSyncTypes: ['status', 'woocommerce', 'ga4', 'gsc', 'pagespeed', 'clarity', 'all'],
    supportedSources: ['woocommerce', 'ga4', 'gsc', 'pagespeed', 'clarity'],
    features: {
      onDemandSync: '通过 sources 参数指定需要同步的数据源，例如：{"sources": ["woocommerce", "ga4"]}',
      dateRange: '通过 startDate 和 endDate 参数指定同步的日期范围'
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 从Google Analytics 4获取页面行为数据
 * @param supabaseClient
 * @param startDate
 * @param endDate
 * @returns
 */
async function syncGA4PageBehaviorData(supabaseClient: any, startDate: string, endDate: string) {
  try {
    const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/analytics.readonly']);
    // @ts-ignore
    const propertyId = Deno.env.get('GA4_PROPERTY_ID');
    if (!propertyId) {
      throw new Error('Missing GA4_PROPERTY_ID in environment variables');
    }
    
    console.log("--- Executing Essential Data Strategy for GA4 (Page Behavior) ---");

    const requestBody = {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'date' },
        { name: 'pagePath' },
        { name: 'deviceCategory' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
      ],
      limit: 200, // 精要策略：仅获取 Top 200
      orderBys: [ // 精要策略：按会话数降序排序
        {
          metric: { metricName: 'sessions' },
          desc: true,
        }
      ]
    };

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GA4 Page Behavior API error (${response.status}): ${errorText}`);
    }

    const reportData = await response.json();
    const rows = reportData.rows || [];
    console.log(`Retrieved ${rows.length} page behavior rows from GA4`);

    if (rows.length === 0) {
      return { success: true, message: 'No new GA4 page behavior data to sync.', count: 0 };
    }

    const recordsToUpsert = rows.map((row: any) => {
      const [dateStr, pagePath, deviceCategory] = row.dimensionValues.map((dim: any) => dim.value);
      const [sessions, engagedSessions, averageSessionDuration, conversions] = row.metricValues.map((metric: any) => parseFloat(metric.value));
      const date = `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`;
      
      return {
        date,
        page_path: pagePath,
        device_category: deviceCategory,
        sessions,
        engaged_sessions: engagedSessions,
        average_session_duration: averageSessionDuration,
        conversions,
        synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseClient
      .from('raw_ga4_page_behavior')
      .upsert(recordsToUpsert, {
        onConflict: 'date, page_path, device_category',
        returning: 'minimal',
      });

    if (error) {
      console.error(`Error during bulk upsert for GA4 page behavior data:`, error);
      throw error;
    }

    return { success: true, message: `Successfully synced ${recordsToUpsert.length} GA4 page behavior entries.`, count: recordsToUpsert.length };

  } catch (error) {
    console.error('Error in syncGA4PageBehaviorData:', error);
    return { success: false, message: `Error syncing GA4 page behavior data: ${error.message}`, error: error.message };
  }
}

// [NEW] Helper function to fetch data from Google PageSpeed Insights API
async function syncPageSpeedData(supabaseAdmin: any, pageUrls: string[]) {
    console.log('Starting PageSpeed Insights data synchronization...');
    // @ts-ignore
    const apiKey = Deno.env.get('PAGESPEED_API_KEY');
    if (!apiKey) {
        console.error('PAGESPEED_API_KEY is not set. Skipping sync.');
        return { success: false, message: 'PAGESPEED_API_KEY not set' };
    }

    const reportsToInsert: any[] = [];
    const today = new Date().toISOString().split('T')[0]; // 获取当天日期作为 report_date

    for (const url of pageUrls) {
        for (const strategy of ['mobile', 'desktop'] as const) {
            const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Failed to fetch PageSpeed data for ${url} (${strategy}): ${response.statusText}`, errorText);
                    continue;
                }
                const data = await response.json();
                if (data.lighthouseResult) {
                    const report: any = {
                        report_date: today, // 添加 report_date 字段
                        page_url: url,
                        strategy: strategy,
                        performance_score: data.lighthouseResult.categories.performance.score,
                        first_contentful_paint_ms: Math.round(data.lighthouseResult.audits['first-contentful-paint']?.numericValue),
                        largest_contentful_paint_ms: Math.round(data.lighthouseResult.audits['largest-contentful-paint']?.numericValue),
                        cumulative_layout_shift: data.lighthouseResult.audits['cumulative-layout-shift']?.numericValue,
                        total_blocking_time_ms: Math.round(data.lighthouseResult.audits['total-blocking-time']?.numericValue),
                        speed_index_ms: Math.round(data.lighthouseResult.audits['speed-index']?.numericValue),
                    };
                    reportsToInsert.push(report);
                }
            } catch (error) {
                console.error(`Error processing PageSpeed data for ${url} (${strategy}):`, error);
            }
        }
    }

    if (reportsToInsert.length > 0) {
        const { error } = await supabaseAdmin.from('pagespeed_reports').upsert(reportsToInsert, { onConflict: 'report_date,page_url,strategy' });
        if (error) {
            console.error('Error saving PageSpeed reports:', error);
            return { success: false, message: 'Failed to save PageSpeed reports', error };
        }
        console.log(`Successfully saved ${reportsToInsert.length} PageSpeed reports.`);
    }
    return { success: true, message: `Synced ${reportsToInsert.length} PageSpeed reports.`, count: reportsToInsert.length };
}

// [NEW] Helper function to fetch data from Microsoft Clarity API
async function syncClarityData(supabaseAdmin: any, projectId: string, startDate: string, endDate: string) {
    console.log(`Starting Microsoft Clarity data synchronization for project ${projectId} from ${startDate} to ${endDate}...`);
    // @ts-ignore
    const apiToken = Deno.env.get('CLARITY_API_TOKEN');
    if (!apiToken) {
        console.error('CLARITY_API_TOKEN is not set. Skipping sync.');
        return { success: false, message: 'CLARITY_API_TOKEN not set' };
    }

    const apiUrl = `https://api.clarity.ms/v1/projects/${projectId}/metrics?startDate=${startDate}&endDate=${endDate}`;
    
    try {
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${apiToken}` } });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch Clarity data: HTTP Status ${response.status}, Status Text: ${response.statusText}, Response Body: ${errorText}`);
            return { success: false, message: `Failed to fetch Clarity data: ${errorText}` };
        }
        const data = await response.json();
        const metricsToInsert: any[] = data.map((metric: any) => ({
            metric_date: endDate, // 使用 endDate 作为 metric_date
            page_url: metric.page,
            dead_clicks: metric.dead_clicks,
            rage_clicks: metric.rage_clicks,
            excessive_scrolling: metric.excessive_scrolling,
            average_scroll_depth_percent: metric.average_scroll_depth,
        }));

        if (metricsToInsert.length > 0) {
            const { error } = await supabaseAdmin.from('clarity_metrics').upsert(metricsToInsert, { onConflict: 'metric_date,page_url' });
            if (error) {
                console.error('Error saving Clarity metrics:', error);
                return { success: false, message: 'Failed to save Clarity metrics', error };
            }
            console.log(`Successfully saved ${metricsToInsert.length} Clarity metrics.`);
        }
        return { success: true, message: `Synced ${metricsToInsert.length} Clarity metrics.`, count: metricsToInsert.length };
    } catch (error) {
        console.error('Error fetching Clarity data:', error);
        return { success: false, message: `Error syncing Clarity data: ${error.message}`, error };
    }
}


/**
 * 主服务处理函数
 */
serve(async (req: Request) => {
  // 预检请求直接返回
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求体以获取参数
    const { type: syncType, startDate: reqStartDate, endDate: reqEndDate, pageUrls, clarityProjectId, sources, scope } = await req.json();

  const supabaseClient = createClient(
      // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // --- 日期参数处理改进 ---
    // 默认结束日期为前一天（昨天），因为很多数据源当天的数据可能不完整
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() - 1); // 默认结束日期为昨天
    
    // 默认开始日期为结束日期前 7 天（一周数据）
    const defaultStartDate = new Date(defaultEndDate);
    defaultStartDate.setDate(defaultEndDate.getDate() - 7); 

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // 从请求体获取日期，如果不存在则使用默认值
    const startDate = reqStartDate || formatDate(defaultStartDate);
    const endDate = reqEndDate || formatDate(defaultEndDate);
    
    // --- 详细的诊断日志 ---
    console.log(`Data sync requested for date range: startDate=${startDate}, endDate=${endDate}`);
    console.log(`Request type: ${syncType}, sources: ${sources ? sources.join(', ') : 'none specified'}`);
    // --- 结束诊断日志 ---

    let result: any = { success: false, message: "Invalid 'type' parameter." };

    // 新增: 处理认证测试请求
    if (syncType === 'auth_test') {
      try {
        let scopes: string[] = [];
        if (scope === 'analytics') {
          scopes = ['https://www.googleapis.com/auth/analytics.readonly'];
        } else if (scope === 'webmasters') {
          scopes = ['https://www.googleapis.com/auth/webmasters.readonly'];
        } else {
          throw new Error('Invalid scope parameter. Use "analytics" or "webmasters"');
        }
        
        console.log(`Testing authentication with scopes: ${scopes.join(', ')}`);
        
        // 尝试获取访问令牌
        const accessToken = await getGoogleAccessToken(scopes);
        
        return new Response(JSON.stringify({
          success: true,
          message: '认证成功',
          token_info: {
            token_exists: !!accessToken,
            token_length: accessToken ? accessToken.length : 0,
            token_preview: accessToken ? `${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}` : null
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (error) {
        console.error('认证测试失败:', error);
        return new Response(JSON.stringify({
          success: false,
          message: '认证失败',
          error: error.message,
          error_details: JSON.stringify(error)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // 如果提供了 sources 参数，则按需同步指定的数据源
    if (sources && Array.isArray(sources) && sources.length > 0) {
      console.log(`按需同步以下数据源: ${sources.join(', ')}`);
      
      const results: Record<string, any> = {};
      let allSuccess = true;
      
      // 遍历所有需要同步的数据源
      for (const source of sources) {
        let sourceResult;
        
        switch (source) {
          case 'woocommerce':
            sourceResult = await syncWooCommerceData(supabaseClient, startDate, endDate);
            break;
          case 'gsc':
            sourceResult = await syncGSCData(supabaseClient, startDate, endDate);
            break;
          case 'ga4':
            const ga4Result = await syncGA4Data(supabaseClient, startDate, endDate);
            const pageBehaviorResult = await syncGA4PageBehaviorData(supabaseClient, startDate, endDate);
            sourceResult = {
              success: ga4Result.success && pageBehaviorResult.success,
              message: `GA4: ${ga4Result.message} | PageBehavior: ${pageBehaviorResult.message}`,
              details: { ga4Result, pageBehaviorResult }
            };
            break;
          case 'pagespeed':
            if (!pageUrls || pageUrls.length === 0) {
              sourceResult = { success: false, message: 'pageUrls array is required for pagespeed sync' };
            } else {
              sourceResult = await syncPageSpeedData(supabaseClient, pageUrls);
            }
            break;
          case 'clarity':
            if (!clarityProjectId) {
              sourceResult = { success: false, message: 'clarityProjectId is required for clarity sync' };
            } else {
              sourceResult = await syncClarityData(supabaseClient, clarityProjectId, startDate, endDate);
            }
            break;
          default:
            sourceResult = { success: false, message: `Unknown data source: ${source}` };
        }
        
        results[source] = sourceResult;
        if (!sourceResult.success) {
          allSuccess = false;
        }
      }
      
      result = {
        success: allSuccess,
        message: allSuccess ? 'All requested data sources synced successfully.' : 'One or more data sources failed to sync.',
        details: results,
        dateRange: { startDate, endDate } // 添加日期范围到响应中，方便前端验证
      };
    } else {
      // 如果没有提供 sources 参数，则按照原来的逻辑处理
    switch (syncType) {
      case 'status':
        result = await getStatus();
        break;
      case 'woocommerce':
          result = await syncWooCommerceData(supabaseClient, startDate, endDate);
        break;
      case 'gsc':
        result = await syncGSCData(supabaseClient, startDate, endDate);
        break;
      case 'ga4':
        const ga4Result = await syncGA4Data(supabaseClient, startDate, endDate);
        const pageBehaviorResult = await syncGA4PageBehaviorData(supabaseClient, startDate, endDate);
        result = {
          success: ga4Result.success && pageBehaviorResult.success,
          message: `GA4: ${ga4Result.message} | PageBehavior: ${pageBehaviorResult.message}`,
            details: { ga4Result, pageBehaviorResult },
            dateRange: { startDate, endDate } // 添加日期范围到响应中
        };
        break;
      case 'pagespeed':
        if (!pageUrls || pageUrls.length === 0) throw new Error('pageUrls array is required for pagespeed sync');
        result = await syncPageSpeedData(supabaseClient, pageUrls);
        break;
      case 'clarity':
        if (!clarityProjectId) throw new Error('clarityProjectId is required for clarity sync');
          result = await syncClarityData(supabaseClient, clarityProjectId, startDate, endDate);
        break;
      case 'all':
        // 同步所有数据源
          const wooResultAll = await syncWooCommerceData(supabaseClient, startDate, endDate);
        const gscResultAll = await syncGSCData(supabaseClient, startDate, endDate);
        const ga4ResultAll = await syncGA4Data(supabaseClient, startDate, endDate);
        const pageBehaviorResultAll = await syncGA4PageBehaviorData(supabaseClient, startDate, endDate);
        const pagespeedResultAll = pageUrls && pageUrls.length > 0 ? await syncPageSpeedData(supabaseClient, pageUrls) : { success: true, message: 'Skipped PageSpeed, no URLs provided.' };
          // 重新启用 Clarity 同步
          const clarityResultAll = clarityProjectId ? await syncClarityData(supabaseClient, clarityProjectId, startDate, endDate) : { success: true, message: 'Skipped Clarity, no project ID provided.' };
        
        const allSuccess = wooResultAll.success && gscResultAll.success && ga4ResultAll.success && pageBehaviorResultAll.success && pagespeedResultAll.success && clarityResultAll.success;

        result = {
          success: allSuccess,
          message: allSuccess ? 'All data sources synced successfully.' : 'One or more data sources failed to sync.',
          details: {
            woocommerce: wooResultAll,
            gsc: gscResultAll,
            ga4: ga4ResultAll,
            ga4_page_behavior: pageBehaviorResultAll,
            pagespeed: pagespeedResultAll,
            clarity: clarityResultAll,
            },
            dateRange: { startDate, endDate } // 添加日期范围到响应中
        };
        break;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 500,
    });
  } catch (err) {
    console.error('Main handler error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 