import {
  serve,
  createClient,
  GoogleAuth,
  corsHeaders,
} from '../_shared/deps.ts';

// Main token acquisition function based on the user's best practice
async function getGoogleAccessToken(scopes: string[]) {
  // 1. Read the full JSON string from the Vault (set via Supabase Studio)
  // @ts-ignore
  const serviceAccountKeyJson = Deno.env.get("GA4_GSC_SERVICE_ACCOUNT_KEY");
  if (!serviceAccountKeyJson) {
      throw new Error("Secret GA4_GSC_SERVICE_ACCOUNT_KEY not found in Vault.");
  }
  
  // 2. Parse the JSON string into an object
  const credentials = JSON.parse(serviceAccountKeyJson);

  // --- 诊断日志 ---
  // 打印关键认证信息，用于排查权限问题
  // 我们只打印私钥的最后20个字符以确保安全
  console.log('Attempting to authenticate with:');
  console.log(`- Client Email: ${credentials.client_email}`);
  console.log(`- Private Key (last 20 chars): ...${credentials.private_key.slice(-20)}`);
  // --- 结束诊断日志 ---

  // 3. Use the parsed credentials for authentication
  const auth = new GoogleAuth({
      credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key, // The private_key here is in the correct format
      },
      scopes,
  });

  const accessToken = await auth.getAccessToken();
  if (!accessToken) {
    throw new Error('Failed to get access token from GoogleAuth');
  }
  return accessToken;
}

/**
 * 从WooCommerce获取订单数据
 * @param supabaseClient Supabase客户端实例
 * @returns 处理结果
 */
async function syncWooCommerceData(supabaseClient: any, startDate: string) {
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

    // 使用传入的 startDate 参数，并确保其为完整的 ISO8601 格式
    const dateAfter = `${startDate}T00:00:00`;
    
    // 构建API URL，包含身份验证和过滤参数
    const apiUrl = `${wooUrl}/wp-json/wc/v3/orders?consumer_key=${wooKey}&consumer_secret=${wooSecret}&after=${dateAfter}&per_page=100`;
    
    // 发送API请求获取订单数据
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }
    
    const orders = await response.json();
    console.log(`Retrieved ${orders.length} orders from WooCommerce`);
    
    // 将订单数据写入数据库
    const results = [];
    for (const order of orders) {
      const { data, error } = await supabaseClient
        .from('raw_woocommerce_orders')
        .upsert({
          order_id: order.id.toString(),
          order_data: order,
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
    
    console.log("--- Executing Essential Data Strategy for GA4 (Channel Performance) ---");

    // 构建GA4 API请求体，严格遵循“精要数据策略”
    const requestBody = {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' }
      ],
      limit: 100, // 精要策略：仅获取 Top 100
      orderBys: [ // 精要策略：按转化量降序排序
        {
          metric: { metricName: 'conversions' },
          desc: true,
        }
      ]
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
    console.log(`Retrieved ${rows.length} rows from GA4`);
    
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
      const [source, medium, campaign] = row.dimensionValues.map((dim: any) => dim.value);
      const [sessions, totalUsers, conversions] = row.metricValues.map((metric: any) => parseInt(metric.value, 10));
      
      return {
        // 注意：由于我们不再按date聚合，因此这里使用endDate作为记录的日期
        date: endDate, 
        source,
        medium,
        campaign,
        sessions,
        total_users: totalUsers,
        conversions,
        synced_at: new Date().toISOString()
      };
    });
    
    // 2. 执行一次性的批量写入操作
    const { error } = await supabaseClient
      .from('raw_ga4_data')
      .upsert(recordsToUpsert, {
        // 更新冲突键，因为维度已经改变
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
    version: '1.0.0',
    availableSyncTypes: ['status', 'woocommerce', 'ga4', 'gsc', 'pagespeed', 'clarity'], // Added new types
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
                        page_url: url,
                        strategy: strategy,
                        performance_score: data.lighthouseResult.categories.performance.score,
                        first_contentful_paint_ms: data.lighthouseResult.audits['first-contentful-paint']?.numericValue,
                        largest_contentful_paint_ms: data.lighthouseResult.audits['largest-contentful-paint']?.numericValue,
                        cumulative_layout_shift: data.lighthouseResult.audits['cumulative-layout-shift']?.numericValue,
                        total_blocking_time_ms: data.lighthouseResult.audits['total-blocking-time']?.numericValue,
                        speed_index_ms: data.lighthouseResult.audits['speed-index']?.numericValue,
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
async function syncClarityData(supabaseAdmin: any, projectId: string) {
    console.log('Starting Microsoft Clarity data synchronization...');
    // @ts-ignore
    const apiToken = Deno.env.get('CLARITY_API_TOKEN');
    if (!apiToken) {
        console.error('CLARITY_API_TOKEN is not set. Skipping sync.');
        return { success: false, message: 'CLARITY_API_TOKEN not set' };
    }

    const apiUrl = `https://api.clarity.ms/v1/projects/${projectId}/metrics`;
    
    try {
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${apiToken}` } });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch Clarity data: ${response.statusText}`, errorText);
            return { success: false, message: `Failed to fetch Clarity data: ${errorText}` };
        }
        const data = await response.json();
        const metricsToInsert: any[] = data.map((metric: any) => ({
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
    const { type: syncType, startDate: reqStartDate, endDate: reqEndDate, pageUrls, clarityProjectId } = await req.json();

  const supabaseClient = createClient(
      // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // --- 日期参数处理 ---
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() - 1); // 默认结束日期为昨天
    const defaultStartDate = new Date(defaultEndDate);
    defaultStartDate.setDate(defaultEndDate.getDate() - 29); // 默认开始日期为30天前

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // 从请求体获取日期，如果不存在则使用默认值
    const startDate = reqStartDate || formatDate(defaultStartDate);
    const endDate = reqEndDate || formatDate(defaultEndDate);
    // --- 结束日期参数处理 ---

    let result: any = { success: false, message: "Invalid 'type' parameter." };

    switch (syncType) {
      case 'status':
        result = await getStatus();
        break;
      case 'woocommerce':
        result = await syncWooCommerceData(supabaseClient, startDate);
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
          details: { ga4Result, pageBehaviorResult }
        };
        break;
      case 'pagespeed':
        if (!pageUrls || pageUrls.length === 0) throw new Error('pageUrls array is required for pagespeed sync');
        result = await syncPageSpeedData(supabaseClient, pageUrls);
        break;
      case 'clarity':
        if (!clarityProjectId) throw new Error('clarityProjectId is required for clarity sync');
        result = await syncClarityData(supabaseClient, clarityProjectId);
        break;
      case 'all':
        // 同步所有数据源
        const wooResultAll = await syncWooCommerceData(supabaseClient, startDate);
        const gscResultAll = await syncGSCData(supabaseClient, startDate, endDate);
        const ga4ResultAll = await syncGA4Data(supabaseClient, startDate, endDate);
        const pageBehaviorResultAll = await syncGA4PageBehaviorData(supabaseClient, startDate, endDate);
        const pagespeedResultAll = pageUrls && pageUrls.length > 0 ? await syncPageSpeedData(supabaseClient, pageUrls) : { success: true, message: 'Skipped PageSpeed, no URLs provided.' };
        const clarityResultAll = clarityProjectId ? await syncClarityData(supabaseClient, clarityProjectId) : { success: true, message: 'Skipped Clarity, no project ID provided.' };
        
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
          }
        };
        break;
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