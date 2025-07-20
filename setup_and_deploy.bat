@echo off
setlocal

REM --- 请在下方填入您的 Supabase 项目参考 ID ---
set PROJECT_REF=rrfurkgzyliqudkjmckk

REM --- Google 服务账号凭证 (GA4 和 GSC 使用相同的凭证) ---
set GA_SERVICE_ACCOUNT_EMAIL=a4-api-access@vertu-1733800437113.iam.gserviceaccount.com
set "GA_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n... (此处省略，脚本将使用完整密钥) ...\n-----END PRIVATE KEY-----"

set "CREDENTIALS_JSON={\"type\": \"service_account\", \"project_id\": \"vertu-1733800437113\", \"private_key\": \"%GA_SERVICE_ACCOUNT_PRIVATE_KEY%\", \"client_email\": \"%GA_SERVICE_ACCOUNT_EMAIL%\"}"

REM --- 其他配置 ---
set GA4_PROPERTY_ID=376048413
set GSC_PROPERTY_URL=https://vertu.com
set WOO_URL=https://vertu.com
set WOO_KEY=ck_17a7ca09f8eb495aa543c014530018e1aad7a3a3
set WOO_SECRET=cs_4ae78e69fafd6b72f172cdb5967fa65f766beef7
set GEMINI_API_KEY=AIzaSyATGs8VCy-gDM2bT_0NbK5mAz1UvGqSelM

REM --- 确保已登录 Supabase CLI ---
echo "正在检查 Supabase 登录状态..."
npx supabase login

REM --- 设置所有 Secrets ---
echo "正在为项目 %PROJECT_REF% 设置 Secrets..."

npx supabase secrets set --project-ref %PROJECT_REF% ^
    GSC_CREDENTIALS_JSON="%CREDENTIALS_JSON%" ^
    GA4_CREDENTIALS_JSON="%CREDENTIALS_JSON%" ^
    GSC_PROPERTY_URL="%GSC_PROPERTY_URL%" ^
    GA4_PROPERTY_ID="%GA4_PROPERTY_ID%" ^
    WOO_URL="%WOO_URL%" ^
    WOO_KEY="%WOO_KEY%" ^
    WOO_SECRET="%WOO_SECRET%" ^
    GEMINI_API_KEY="%GEMINI_API_KEY%"

if %errorlevel% neq 0 (
    echo "设置 Secrets 失败！请检查错误信息。"
    exit /b 1
)

echo "所有 Secrets 已成功设置！"

REM --- 第二步：应用数据库迁移 ---
echo "正在应用数据库迁移..."
npx supabase db push --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo "数据库迁移失败！请检查错误信息。"
    exit /b 1
)
echo "数据库迁移成功！"

REM --- 第三步：部署 Edge Function ---
echo "正在部署 Edge Function (sync-external-data)..."
npx supabase functions deploy sync-external-data --project-ref %PROJECT_REF% --no-verify-jwt
if %errorlevel% neq 0 (
    echo "Edge Function 部署失败！请检查错误信息。"
    exit /b 1
)
echo "Edge Function 部署成功！"

echo "所有操作已完成。"
endlocal
pause 