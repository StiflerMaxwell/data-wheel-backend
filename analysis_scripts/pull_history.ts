// analysis_scripts/pull_history.ts

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 配置 ---
// 加载 .env.local 文件中的环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL or Service Key is not defined in .env.local');
}

// 初始化 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- 主函数 ---

/**
 * 按指定的时间间隔（例如 'month' 或 'week'）调用云函数以拉取历史数据。
 * @param {string} overallStartDate - 总的历史数据拉取开始日期 (YYYY-MM-DD)。
 * @param {string} overallEndDate - 总的历史数据拉取结束日期 (YYYY-MM-DD)。
 * @param {'woocommerce' | 'gsc' | 'ga4' | 'all'} syncType - 要同步的数据类型。
 * @param {'month' | 'week'} interval - 拉取数据的时间间隔。
 */
async function pullHistory(
  overallStartDate: string,
  overallEndDate: string,
  syncType: 'woocommerce' | 'gsc' | 'ga4' | 'all',
  interval: 'month' | 'week' = 'month'
) {
  console.log(`🚀 Starting historical data pull for [${syncType}] from ${overallStartDate} to ${overallEndDate}...`);

  let currentStartDate = new Date(overallStartDate);
  const finalEndDate = new Date(overallEndDate);

  while (currentStartDate <= finalEndDate) {
    let currentEndDate = new Date(currentStartDate);
    
    // 计算当前周期的结束日期
    if (interval === 'month') {
      currentEndDate.setMonth(currentEndDate.getMonth() + 1);
      currentEndDate.setDate(currentEndDate.getDate() - 1);
    } else { // week
      currentEndDate.setDate(currentEndDate.getDate() + 6);
    }

    // 确保不会超过总的结束日期
    if (currentEndDate > finalEndDate) {
      currentEndDate = finalEndDate;
    }
    
    const startDateStr = currentStartDate.toISOString().split('T')[0];
    const endDateStr = currentEndDate.toISOString().split('T')[0];

    console.log(`\nFetching data for period: ${startDateStr} to ${endDateStr}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-data', {
        body: { type: syncType, startDate: startDateStr, endDate: endDateStr },
      });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Success:', data.message || 'Completed');
      if(data.details){
        console.log('   - WooCommerce:', data.details.woocommerce?.message);
        console.log('   - GSC:', data.details.gsc?.message);
        console.log('   - GA4:', data.details.ga4?.message);
        console.log('   - GA4 Page Behavior:', data.details.ga4_page_behavior?.message);
      }

    } catch (err) {
      console.error(`❌ Error fetching data for ${startDateStr} to ${endDateStr}:`, err.message);
      // 可选择在这里停止或继续下一个周期
      // break; 
    }
    
    // 准备下一个周期的开始日期
    currentStartDate = new Date(currentEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + 1);

    // 添加一个小的延迟避免过于频繁地调用API
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒延迟
  }

  console.log('\n🎉 Historical data pull finished!');
}


// --- 执行 ---
// 使用方法示例:
// node pull_history.ts <start_date> <end_date> <sync_type>
const [,, startDate, endDate, syncType] = process.argv;

if (!startDate || !endDate || !syncType) {
  console.log('Usage: tsx analysis_scripts/pull_history.ts <startDate> <endDate> <syncType>');
  console.log('Example: tsx analysis_scripts/pull_history.ts 2023-01-01 2023-12-31 all');
  process.exit(1);
}

pullHistory(startDate, endDate, syncType as any); 