#!/bin/bash
# 用全局安装的 typescript 校验所有 TS 代码（无需真实数据库）
set -e
cd /data/workspace/finance-hot-agent

GLOBAL="/usr/local/lib/node_modules"
export NODE_PATH="$GLOBAL"

# 需要一个 tsconfig（已存在则跳过）
if [ ! -f tsconfig.json ]; then
  echo "缺少 tsconfig，已存在，跳过"
fi

# 生成一份包含全部源文件的临时 tsconfig（allowJs false，strict）
cat > tsconfig.check.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": { "*": ["node_modules/*"] },
    "types": []
  },
  "include": ["src/**/*", "prisma/**/*", "scripts/**/*"]
}
EOF

echo "=== 运行 TypeScript 类型检查（strict） ==="
node "$GLOBAL/typescript/lib/tsc.js" --project tsconfig.check.json --noEmit
echo "✅ 类型检查通过（无错误）"
