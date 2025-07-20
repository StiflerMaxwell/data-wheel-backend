@echo off
echo 正在部署 sync-external-data Edge Function...

REM 部署Edge Function
npx supabase functions deploy sync-external-data --no-verify-jwt
 
echo 部署完成! 可以通过以下命令测试:
echo.
echo curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-external-data?type=ga4" -H "Authorization: Bearer YOUR_ANON_KEY"
echo.
echo 记得替换 YOUR_PROJECT_REF 和 YOUR_ANON_KEY 为您的实际值 