#!/bin/bash

# deploy.sh
# 该脚本用于在部署到Vercel之前运行核心功能测试。
# 如果测试失败，脚本将中止，从而阻止部署。

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}步骤 1/4: 确保所有依赖已安装...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}错误：'npm install' 失败。请检查错误信息。${NC}"
    exit 1
fi

echo -e "\n${GREEN}步骤 2/5: 运行核心后端功能测试...${NC}"
npm test
if [ $? -ne 0 ]; then
    echo -e "\n${RED}错误：核心后端功能测试失败！部署已中止。${NC}"
    exit 1
else
    echo -e "\n${GREEN}✅ 后端测试通过。${NC}"
fi

echo -e "\n${GREEN}步骤 3/5: 编译前端样式...${NC}"
npm run build:css
if [ $? -ne 0 ]; then
    echo -e "\n${RED}错误：CSS编译失败！部署已中止。${NC}"
    exit 1
fi

echo -e "\n${GREEN}步骤 4/5: 运行前端端到端(E2E)测试...${NC}"
echo "  - 正在后台启动本地服务器..."
python3 -m http.server 8000 --directory public &
SERVER_PID=$!
# 等待服务器启动
sleep 2

echo "  - 正在运行 Playwright 测试..."
npm run test:e2e
TEST_RESULT=$?

echo "  - 正在关闭本地服务器..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

if [ $TEST_RESULT -ne 0 ]; then
    echo -e "\n${RED}错误：前端E2E测试失败！部署已中止。${NC}"
    exit 1
else
    echo -e "\n${GREEN}✅ 前端测试通过。${NC}"
fi


echo -e "\n${GREEN}步骤 5/5: 正在部署到 Vercel 生产环境...${NC}"
vercel --prod

if [ $? -ne 0 ]; then
    echo -e "\n${RED}错误：Vercel 部署失败。${NC}"
    exit 1
else
    echo -e "\n${GREEN}🎉 Vercel 部署成功！${NC}"
fi

exit 0 