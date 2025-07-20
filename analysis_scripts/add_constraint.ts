import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
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

async function addUniqueConstraint() {
  console.log('正在添加唯一约束到 raw_ga4_page_behavior 表...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE public.raw_ga4_page_behavior
        ADD CONSTRAINT raw_ga4_page_behavior_unique_row
        UNIQUE (date, page_path, device_category);
      `
    });
    
    if (error) throw error;
    
    console.log('✅ 唯一约束添加成功！');
    return data;
  } catch (error) {
    console.error('❌ 添加约束失败:', error.message);
    // 如果错误是因为约束已存在，我们可以认为这是"成功"的
    if (error.message.includes('already exists')) {
      console.log('✅ 约束已存在，无需添加。');
    }
  }
}

// 执行函数
addUniqueConstraint(); 