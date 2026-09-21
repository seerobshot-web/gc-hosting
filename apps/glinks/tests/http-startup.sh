#!/usr/bin/env bash
# Live TCP startup check. Run after native database and concurrency checks.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-closed}"
[[ "$mode" == closed || "$mode" == open ]] || { echo "Use closed or open" >&2; exit 1; }
flag=false
[[ "$mode" == open ]] && flag=true
port="${GLINKS_HTTP_TEST_PORT:-18091}"
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 && port <= 65535 )) || {
  echo "Invalid GLINKS_HTTP_TEST_PORT" >&2; exit 1;
}
command -v php >/dev/null
command -v curl >/dev/null
[[ -f vendor/autoload.php ]] || { echo "Install composer.lock first" >&2; exit 1; }
base="http://127.0.0.1:$port"
mkdir -p writable/logs
log="writable/logs/http-startup.log"
temporary=$(mktemp -d)
server_pid=''
cleanup() {
  result=$?
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if (( result != 0 )); then cat "$log" >&2; fi
  rm -f "$temporary/body" "$temporary/headers"
  rmdir "$temporary"
  exit "$result"
}
trap cleanup EXIT
: >"$log"
if curl --silent --output /dev/null --connect-timeout 1 --max-time 2 "$base/health/live"; then
  echo "Test port already in use; refusing to test an unrelated server" >&2
  exit 1
fi

# Explicitly test the ordinary runtime with the route gate CLOSED.
# These variables affect only this child process, never a saved .env.
CI_ENVIRONMENT=development glinks_enableTenantRoutes="$flag" app_baseURL="$base/" \
  php -S "127.0.0.1:$port" -t public vendor/codeigniter4/framework/system/rewrite.php >"$log" 2>&1 &
server_pid=$!
started=false
for ((i=0;i<60;i++)); do
  kill -0 "$server_pid" 2>/dev/null || { echo "PHP exited before startup" >&2; exit 1; }
  if curl --silent --fail --connect-timeout 1 --max-time 2 "$base/health/live" >"$temporary/body"; then
    started=true
    break
  fi
  sleep 0.25
done
[[ "$started" == true ]] || { echo "HTTP startup timed out" >&2; exit 1; }
kill -0 "$server_pid" 2>/dev/null

check_json() {
  path=$1
  expected=$2
  code=$(curl --silent --show-error --max-time 5 -D "$temporary/headers" -o "$temporary/body" -w '%{http_code}' "$base/$path")
  [[ "$code" == 200 ]] || { echo "$path returned $code" >&2; exit 1; }
  grep -Eiq '^content-type: application/json' "$temporary/headers"
  grep -Eiq '^cache-control:.*no-store' "$temporary/headers"
  php -r '$data=json_decode(file_get_contents($argv[1]),true,512,JSON_THROW_ON_ERROR); if (($data["status"] ?? null) !== $argv[2]) { exit(1); }' "$temporary/body" "$expected"
}
check_json health/live alive
check_json health/ready ready
if [[ "$mode" == closed ]]; then
for path in login register workspaces workspaces/1/pages/1 recover invitations/accept; do
  code=$(curl --silent --show-error --max-time 5 -o "$temporary/body" -w '%{http_code}' "$base/$path")
  [[ "$code" == 404 ]] || { echo "Closed route $path returned $code, expected 404" >&2; exit 1; }
done
else
  for path in login register recover; do
    code=$(curl --silent --show-error --max-time 5 -o "$temporary/body" -w '%{http_code}' "$base/$path")
    [[ "$code" == 200 ]] || { echo "Open route $path returned $code" >&2; exit 1; }
  done
  code=$(curl --silent --show-error --max-time 5 -D "$temporary/headers" -o "$temporary/body" -w '%{http_code}' "$base/workspaces")
  [[ "$code" == 302 || "$code" == 303 ]]
  grep -Eiq "^location: $base/login" "$temporary/headers"
fi
kill -0 "$server_pid" 2>/dev/null
echo "PASS: live HTTP startup, database readiness, and $mode tenant route gate"

