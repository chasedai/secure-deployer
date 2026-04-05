#!/usr/bin/env bash
set -euo pipefail

# Secure Deployer — 一键安装脚本
# 用法: curl -fsSL https://raw.githubusercontent.com/yourrepo/secure-deployer/main/scripts/install.sh | bash

INSTALL_DIR="/opt/secure-deployer"
SERVICE_NAME="secure-deployer"
REPO_URL="https://github.com/yourrepo/secure-deployer"  # 替换为实际仓库地址
MIN_NODE_VERSION=18

echo ""
echo "============================================"
echo "  Secure Deployer — 一键安装"
echo "============================================"
echo ""

# --- Helpers ---

info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
fail()  { echo -e "\033[1;31m[FAIL]\033[0m  $*"; exit 1; }

check_root() {
  if [[ $EUID -ne 0 ]]; then
    fail "请用 root 权限运行此脚本: sudo bash install.sh"
  fi
}

# --- Check / Install Node.js ---

install_node() {
  if command -v node &>/dev/null; then
    local ver
    ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$ver" -ge "$MIN_NODE_VERSION" ]]; then
      ok "Node.js $(node -v) 已安装"
      return
    fi
    warn "Node.js 版本过低 ($(node -v)), 需要 v${MIN_NODE_VERSION}+"
  fi

  info "安装 Node.js 20.x ..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    fail "不支持的包管理器，请手动安装 Node.js 20+"
  fi
  ok "Node.js $(node -v) 安装完成"
}

# --- Check / Install PM2 ---

install_pm2() {
  if command -v pm2 &>/dev/null; then
    ok "PM2 已安装"
    return
  fi
  info "安装 PM2 ..."
  npm install -g pm2
  ok "PM2 安装完成"
}

# --- Download and Setup ---

setup_app() {
  if [[ -d "$INSTALL_DIR" ]]; then
    warn "检测到已有安装，将更新..."
    cd "$INSTALL_DIR"
    if [[ -d ".git" ]]; then
      git pull
    fi
  else
    info "下载 Secure Deployer ..."
    git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || {
      # 如果 git clone 失败，尝试创建目录并提示手动安装
      mkdir -p "$INSTALL_DIR"
      warn "Git clone 失败。请手动将项目文件放到 ${INSTALL_DIR}"
      warn "或者直接在项目目录运行: npm install && npm run build && npm start"
      return 1
    }
    cd "$INSTALL_DIR"
  fi

  info "安装依赖 ..."
  npm install --production 2>/dev/null || npm install

  # 构建 dashboard（如果有源码）
  if [[ -f "dashboard/package.json" ]] && [[ -d "dashboard/src" ]]; then
    info "构建管理界面 ..."
    npm run build 2>/dev/null || warn "Dashboard 构建失败，可能已经预构建过"
  fi

  ok "安装完成: ${INSTALL_DIR}"
}

# --- Start with PM2 ---

start_service() {
  info "启动 Secure Deployer ..."

  cd "$INSTALL_DIR"

  # 如果已经在运行，先停掉
  pm2 stop "$SERVICE_NAME" 2>/dev/null || true
  pm2 delete "$SERVICE_NAME" 2>/dev/null || true

  pm2 start agent/src/index.mjs \
    --name "$SERVICE_NAME" \
    --cwd "$INSTALL_DIR" \
    --time

  pm2 save
  pm2 startup 2>/dev/null || true

  ok "服务已启动"
}

# --- Print Result ---

print_result() {
  local config_file="$HOME/.secure-deployer/config.json"
  local api_key=""
  local api_port="9876"
  local dash_port="9877"

  if [[ -f "$config_file" ]]; then
    api_key=$(python3 -c "import json; print(json.load(open('$config_file'))['apiKey'])" 2>/dev/null || echo "见配置文件")
    api_port=$(python3 -c "import json; print(json.load(open('$config_file'))['apiPort'])" 2>/dev/null || echo "9876")
    dash_port=$(python3 -c "import json; print(json.load(open('$config_file'))['dashPort'])" 2>/dev/null || echo "9877")
  fi

  local ip
  ip=$(curl -s ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

  echo ""
  echo "============================================"
  echo "  安装完成！"
  echo "============================================"
  echo ""
  echo "  管理界面: http://${ip}:${dash_port}"
  echo "  API 地址: http://${ip}:${api_port}"
  echo "  API Key:  ${api_key}"
  echo ""
  echo "  下一步:"
  echo "  1. 在浏览器打开管理界面，设置管理密码"
  echo "  2. 进入「Skill 生成」页面，生成 AI 接入文档"
  echo "  3. 将文档提供给你的 AI 模型"
  echo ""
  echo "  确保防火墙放行端口 ${api_port} 和 ${dash_port}"
  echo ""
  echo "  管理命令:"
  echo "    pm2 status          # 查看运行状态"
  echo "    pm2 logs ${SERVICE_NAME}  # 查看日志"
  echo "    pm2 restart ${SERVICE_NAME}  # 重启服务"
  echo "============================================"
  echo ""
}

# --- Main ---

check_root
install_node
install_pm2
setup_app
start_service
print_result
