#!/bin/zsh
set -euo pipefail

PORT=3489
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$ROOT_DIR/.run"
PID_FILE="$STATE_DIR/emris-prektas.pid"
LOG_FILE="$STATE_DIR/emris-prektas.log"

mkdir -p "$STATE_DIR"

print_url() {
  local ip
  ip="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
  echo ""
  echo "── 추천 도구 (/) ──"
  echo "Local:     http://127.0.0.1:${PORT}/"
  echo "LAN:       http://0.0.0.0:${PORT}/"
  if [[ -n "$ip" ]]; then
    echo "Tailscale: http://${ip}:${PORT}/"
  fi
  echo ""
  echo "── 연구 설명 (/research.html) ──"
  echo "Local:     http://127.0.0.1:${PORT}/research.html"
  if [[ -n "$ip" ]]; then
    echo "Tailscale: http://${ip}:${PORT}/research.html"
  fi
  echo ""
  echo "── Phase 10b vignette 검토 (/vignette-review.html) ──"
  echo "Local:     http://127.0.0.1:${PORT}/vignette-review.html"
  if [[ -n "$ip" ]]; then
    echo "Tailscale: http://${ip}:${PORT}/vignette-review.html"
  fi
  echo ""
  echo "── Phase 9b 매핑성 매트릭스 검토 (/mappability-review.html) ──"
  echo "Local:     http://127.0.0.1:${PORT}/mappability-review.html"
  if [[ -n "$ip" ]]; then
    echo "Tailscale: http://${ip}:${PORT}/mappability-review.html"
  fi
  echo ""
  echo "── Phase 8a-2 자문 도구 (/consultation.html) ──"
  echo "Local:     http://127.0.0.1:${PORT}/consultation.html"
  if [[ -n "$ip" ]]; then
    echo "Tailscale: http://${ip}:${PORT}/consultation.html"
  fi
  echo ""
}

stop_server() {
  local pids
  pids="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill >/dev/null 2>&1 || true
    sleep 1
    pids="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$PID_FILE"
  echo "Stopped port ${PORT}."
}

start_server() {
  "$ROOT_DIR/run.sh" stop >/dev/null 2>&1 || true
  cd "$ROOT_DIR"

  if [[ ! -f "prektas-hospital-recommender.html" ]] || [[ ! -f "prektas-research.html" ]]; then
    echo "Building HTML..."
    npm run build:html >/dev/null
  fi

  # public/ 은 index.html → 추천도구, research.html → 연구설명 심볼릭 링크로 구성.
  # 기존 index.html (Gemini 챗봇)과 격리.
  nohup python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$ROOT_DIR/public" </dev/null >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 1
  if ! kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1 || ! lsof -ti tcp:${PORT} >/dev/null 2>&1; then
    echo "Failed to start server on port ${PORT}."
    [[ -f "$LOG_FILE" ]] && tail -n 20 "$LOG_FILE"
    exit 1
  fi
  echo "Started server on port ${PORT}."
  print_url
}

case "${1:-start}" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    start_server
    ;;
  *)
    echo "Usage: ./run.sh {start|stop|restart}"
    exit 1
    ;;
esac
