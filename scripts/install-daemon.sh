#!/bin/bash
# 자동시작 데몬 등록 — 컴퓨터 재부팅·로그인 후 봇이 자동으로 켜지게 한다.
#   macOS: launchd LaunchAgent / Linux: systemd user service
# 사용법:  bash install-daemon.sh           (등록)
#          bash install-daemon.sh uninstall (해제)
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_DIR/lib.sh"   # APP_NAME, DATA_DIR
RUN="$REPO_DIR/bot/run.sh"
ACTION="${1:-install}"
OS="$(uname)"

mkdir -p "$DATA_DIR"

# launchd/systemd 는 사용자 셸 PATH 를 물려받지 않는다 → 봇이 spawn 하는 `claude`(보통 /opt/homebrew/bin),
# `bun`(~/.bun/bin) 을 못 찾는다. 데몬에 명시 PATH 를 박는다. (claude 미발견 시 "Executable not found" 방지)
DAEMON_PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [ "$OS" = "Darwin" ]; then
  LABEL="com.80x24.$APP_NAME"
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  if [ "$ACTION" = "uninstall" ]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ 데몬 해제됨 ($LABEL)"
    exit 0
  fi
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$RUN</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$DAEMON_PATH</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>$REPO_DIR/bot</string>
  <key>StandardOutPath</key><string>$DATA_DIR/daemon.log</string>
  <key>StandardErrorPath</key><string>$DATA_DIR/daemon.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "✓ macOS LaunchAgent 등록: $LABEL"
  echo "  재부팅·로그인 후 자동 실행됩니다. 로그: $DATA_DIR/daemon.log"
  echo "  해제: bash install-daemon.sh uninstall"

elif [ "$OS" = "Linux" ]; then
  UNIT="$HOME/.config/systemd/user/$APP_NAME.service"
  if [ "$ACTION" = "uninstall" ]; then
    systemctl --user disable --now "$APP_NAME.service" 2>/dev/null || true
    rm -f "$UNIT"; systemctl --user daemon-reload 2>/dev/null || true
    echo "✓ 데몬 해제됨 ($APP_NAME.service)"
    exit 0
  fi
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$UNIT" <<EOF
[Unit]
Description=$APP_NAME bot (auto-start)
After=network-online.target

[Service]
Environment=PATH=$DAEMON_PATH
ExecStart=/bin/bash $RUN
Restart=always
RestartSec=5
WorkingDirectory=$REPO_DIR/bot
StandardOutput=append:$DATA_DIR/daemon.log
StandardError=append:$DATA_DIR/daemon.log

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now "$APP_NAME.service"
  loginctl enable-linger "$USER" 2>/dev/null || true  # 로그아웃 후에도 유지 (재부팅 자동)
  echo "✓ systemd user service 등록: $APP_NAME.service"
  echo "  재부팅 후 자동 실행됩니다. 로그: $DATA_DIR/daemon.log"
  echo "  해제: bash install-daemon.sh uninstall"

else
  echo "✗ 지원하지 않는 OS: $OS (macOS / Linux 만)"
  exit 1
fi
