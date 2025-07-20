@echo off
echo 开始运行 Google Analytics 4 数据分析...

cd %~dp0
npm run ts-node -- run-analysis.ts ga4
 
echo GA4数据分析完成! 