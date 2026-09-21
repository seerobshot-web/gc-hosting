#!/usr/bin/env bash
# Run only on a native, disposable PostgreSQL server, after migrations.
set -euo pipefail
: "${GLINKS_TEST_DATABASE_URL:?Set a disposable glinks_test database URL}"
db_name=$(psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT current_database()')
if [[ "$db_name" != "glinks_test" ]]; then
  echo "Refusing concurrency fixture outside glinks_test" >&2
  exit 1
fi
fixture=$(psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
WITH users AS (
  INSERT INTO glinks.users(auth_provider,auth_subject)
  SELECT 'concurrency-test',gen_random_uuid()::text FROM generate_series(1,2) RETURNING id
), workspace AS (
  INSERT INTO glinks.workspaces(name) VALUES ('Concurrent owner fixture') RETURNING id
), members AS (
  INSERT INTO glinks.memberships(workspace_id,user_id,role)
  SELECT workspace.id,users.id,'owner' FROM workspace CROSS JOIN users RETURNING *
)
SELECT workspace_id||' '||min(user_id)||' '||max(user_id)
FROM members GROUP BY workspace_id;
COMMIT;
SQL
)
[[ "$fixture" =~ ^[0-9]+\ [0-9]+\ [0-9]+$ ]] || { echo "Invalid fixture IDs" >&2; exit 1; }
read -r workspace first second <<< "$fixture"
temporary=$(mktemp -d)
trap 'rm -f "$temporary/first.log" "$temporary/second.log"; rmdir "$temporary"' EXIT

PGAPPNAME="glinks-owner-first-$workspace" psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 >"$temporary/first.log" 2>&1 <<SQL &
BEGIN;
UPDATE glinks.memberships SET role='viewer' WHERE workspace_id=$workspace AND user_id=$first;
\echo locked
SELECT pg_sleep(10);
COMMIT;
SQL
first_pid=$!
for ((i=0;i<100;i++)); do
  if grep -q '^locked$' "$temporary/first.log"; then break; fi
  sleep 0.05
done
if ! grep -q '^locked$' "$temporary/first.log"; then
  wait "$first_pid" || true
  echo "First connection did not obtain its lock" >&2
  exit 1
fi

PGAPPNAME="glinks-owner-second-$workspace" psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose >"$temporary/second.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL lock_timeout='20s';
SET LOCAL statement_timeout='25s';
UPDATE glinks.memberships SET role='viewer' WHERE workspace_id=$workspace AND user_id=$second;
COMMIT;
SQL
second_pid=$!
# Observe the database lock relationship, not just the order of log messages.
# If scheduling turns this into sequential execution, fail instead of claiming concurrency.
overlap=false
for ((i=0;i<100;i++)); do
  blocked=$(psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity waiting
      JOIN pg_stat_activity holder ON holder.pid=ANY(pg_blocking_pids(waiting.pid))
      WHERE waiting.application_name='glinks-owner-second-$workspace'
        AND holder.application_name='glinks-owner-first-$workspace'
    )")
  if [[ "$blocked" == t ]]; then overlap=true; break; fi
  sleep 0.05
done
first_result=0
second_result=0
wait "$first_pid" || first_result=$?
wait "$second_pid" || second_result=$?
[[ "$overlap" == true ]] || { echo "FAIL: no overlapping lock wait observed" >&2; exit 1; }
(( first_result == 0 )) || { cat "$temporary/first.log"; exit 1; }
(( second_result != 0 )) || { echo "FAIL: both owners were demoted" >&2; exit 1; }

grep -q '23514' "$temporary/second.log" || { cat "$temporary/second.log"; exit 1; }
owners=$(psql "$GLINKS_TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM glinks.memberships WHERE workspace_id=$workspace AND role='owner'")
[[ "$owners" == "1" ]]
echo "PASS: concurrent owner demotions retain exactly one owner"
