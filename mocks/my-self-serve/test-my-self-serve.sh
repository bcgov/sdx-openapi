#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
MAIN_TS="${MAIN_TS:-main.ts}"
IMPORT_FILE="${IMPORT_FILE:-data/import.yaml}"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

json_get() {
  python3 - "$1" "$2" <<'PY'
import json
import sys

body = sys.argv[1]
path = sys.argv[2].split(".")

try:
    data = json.loads(body)
except Exception as exc:
    print(f"JSON parse error: {exc}", file=sys.stderr)
    sys.exit(2)

value = data
for part in path:
    if isinstance(value, list):
        value = value[int(part)]
    else:
        value = value[part]

if isinstance(value, (dict, list)):
    print(json.dumps(value))
else:
    print(value)
PY
}

json_len() {
  python3 - "$1" "$2" <<'PY'
import json
import sys

body = sys.argv[1]
path = sys.argv[2].split(".")

data = json.loads(body)
value = data

for part in path:
    if isinstance(value, list):
        value = value[int(part)]
    else:
        value = value[part]

print(len(value))
PY
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"

  [[ "${actual}" == "${expected}" ]] || fail "${label}: expected HTTP ${expected}, got ${actual}"
  pass "${label}"
}

assert_json_field_equals() {
  local body="$1"
  local path="$2"
  local expected="$3"
  local label="$4"

  local actual
  actual="$(json_get "${body}" "${path}")"

  [[ "${actual}" == "${expected}" ]] || fail "${label}: expected ${path}=${expected}, got ${actual}"
  pass "${label}"
}

assert_json_field_present() {
  local body="$1"
  local path="$2"
  local label="$3"

  json_get "${body}" "${path}" >/dev/null || fail "${label}: missing JSON field ${path}"
  pass "${label}"
}

assert_body_contains() {
  local body="$1"
  local expected="$2"
  local label="$3"

  [[ "${body}" == *"${expected}"* ]] || fail "${label}: response did not contain '${expected}'"
  pass "${label}"
}

request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local data="${4:-}"
  local extra_header="${5:-}"

  local response
  local status
  local body

  if [[ -n "${data}" ]]; then
    response="$(
      curl -sS -w $'\n%{http_code}' \
        -X "${method}" \
        ${token:+-H "Authorization: Bearer ${token}"} \
        ${extra_header:+-H "${extra_header}"} \
        -H "Content-Type: application/json" \
        -d "${data}" \
        "${BASE_URL}${path}"
    )"
  else
    response="$(
      curl -sS -w $'\n%{http_code}' \
        -X "${method}" \
        ${token:+-H "Authorization: Bearer ${token}"} \
        ${extra_header:+-H "${extra_header}"} \
        "${BASE_URL}${path}"
    )"
  fi

  status="$(tail -n1 <<<"${response}")"
  body="$(sed '$d' <<<"${response}")"

  printf '%s\t%s\n' "${status}" "${body//$'\n'/ }"
}

request_import() {
  local token="${1:-}"

  local response
  local status
  local body

  response="$(
    curl -sS -w $'\n%{http_code}' \
      -X PUT \
      ${token:+-H "Authorization: Bearer ${token}"} \
      --data-binary @"${IMPORT_FILE}" \
      "${BASE_URL}/data"
  )"

  status="$(tail -n1 <<<"${response}")"
  body="$(sed '$d' <<<"${response}")"

  printf '%s\t%s\n' "${status}" "${body//$'\n'/ }"
}

make_token() {
  local payload="$1"

  local encoded
  encoded="$(
    printf '%s' "${payload}" \
      | base64 \
      | tr -d '=' \
      | tr '+/' '-_' \
      | tr -d '\n'
  )"

  printf 'header.%s.sig' "${encoded}"
}

md5_upper() {
  printf '%s' "$1" | md5sum | awk '{print toupper($1)}'
}

start_server() {
  echo "Starting mock API..."
  deno run --allow-net --allow-read --allow-write "${MAIN_TS}" >/tmp/my-self-serve-mock.log 2>&1 &
  SERVER_PID="$!"

  for _ in $(seq 1 40); do
    if curl -sS "${BASE_URL}/health" >/dev/null 2>&1; then
      pass "server started"
      return
    fi
    sleep 0.25
  done

  echo "Server log:" >&2
  cat /tmp/my-self-serve-mock.log >&2 || true
  fail "server did not start"
}

check_existing_server() {
  echo "Using existing API at ${BASE_URL}"

  if curl -sS "${BASE_URL}/health" >/dev/null 2>&1; then
    pass "existing API is reachable"
    return
  fi

  fail "existing API is not reachable at ${BASE_URL}"
}

require_command curl
require_command python3
require_command base64
require_command md5sum
require_command awk

[[ -f "${IMPORT_FILE}" ]] || fail "Cannot find ${IMPORT_FILE}"

if [[ "${BASE_URL}" == "http://localhost:8000" ]]; then
  require_command deno
  [[ -f "${MAIN_TS}" ]] || fail "Cannot find ${MAIN_TS}"
fi

ADMIN_TOKEN="$(make_token '{"sub":"admin-001","role":"ADMIN","idir_username":"mockadmin"}')"

JANE_SUBJECT="$(md5_upper "Jane Client")"
JANE_TOKEN="$(make_token "{\"sub\":\"${JANE_SUBJECT}\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Jane Client\"}")"
JANE_WRONG_BCEID_TOKEN="$(make_token "{\"sub\":\"${JANE_SUBJECT}\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Wrong Client\"}")"
JANE_BCEID_ONLY_WRONG_SUB_TOKEN="$(make_token "{\"sub\":\"wrong-subject\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Jane Client\"}")"

ALEX_SUBJECT="$(md5_upper "Alex Client")"
ALEX_TOKEN="$(make_token "{\"sub\":\"${ALEX_SUBJECT}\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Alex Client\"}")"

HARPER_SUBJECT="$(md5_upper "Harper Client")"
HARPER_TOKEN="$(make_token "{\"sub\":\"${HARPER_SUBJECT}\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Harper Client\"}")"

NO_SUB_TOKEN="$(make_token '{"role":"CLIENT","bceid_guid":"BCEID:Jane Client"}')"

if [[ "${BASE_URL}" == "http://localhost:8000" ]]; then
  start_server
else
  check_existing_server
fi

echo
echo "Testing public and utility endpoints..."

read -r STATUS BODY < <(request "GET" "/health")
assert_status "${STATUS}" "200" "GET /health returns 200"
assert_json_field_equals "${BODY}" "status" "ok" "GET /health status is ok"
assert_json_field_equals "${BODY}" "db" "ok" "GET /health db is ok"
assert_json_field_equals "${BODY}" "redis" "ok" "GET /health redis is ok"

read -r STATUS BODY < <(request_import "")
assert_status "${STATUS}" "401" "PUT /data without token returns 401"
assert_body_contains "${BODY}" "Missing or invalid authentication token" "PUT /data without token error body"

read -r STATUS BODY < <(request_import "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "PUT /data with client token returns 200"
assert_json_field_equals "${BODY}" "imported.serviceRequests" "42" "PUT /data imports expected service request count"
assert_json_field_equals "${BODY}" "imported.accounts" "16" "PUT /data imports expected account count"

echo
echo "Testing auth failures for client-scoped endpoints..."

read -r STATUS BODY < <(request "GET" "/service-requests")
assert_status "${STATUS}" "401" "GET /service-requests without token returns 401"

read -r STATUS BODY < <(request "GET" "/service-requests" "${NO_SUB_TOKEN}")
assert_status "${STATUS}" "401" "GET /service-requests without sub returns 401"
assert_body_contains "${BODY}" "Missing sub claim" "missing subject response body"

read -r STATUS BODY < <(request "GET" "/account/profile")
assert_status "${STATUS}" "401" "GET /account/profile without token returns 401"

read -r STATUS BODY < <(request "GET" "/account/profile" "${NO_SUB_TOKEN}")
assert_status "${STATUS}" "401" "GET /account/profile without sub returns 401"
assert_body_contains "${BODY}" "Missing sub claim" "account missing subject response body"

echo
echo "Testing GET /service-requests..."

read -r STATUS BODY < <(request "GET" "/service-requests" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests returns 200"
assert_json_field_equals "${BODY}" "total" "4" "Jane Client sees 4 SRs"

JANE_ITEM_COUNT="$(json_len "${BODY}" "items")"
[[ "${JANE_ITEM_COUNT}" == "4" ]] || fail "GET /service-requests: expected 4 Jane items, got ${JANE_ITEM_COUNT}"
pass "GET /service-requests item count matches Jane Client"

read -r STATUS BODY < <(request "GET" "/service-requests" "${JANE_WRONG_BCEID_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests ignores wrong bceid_guid claim"
assert_json_field_equals "${BODY}" "total" "4" "Jane Client still matches by sub when bceid_guid is wrong"

read -r STATUS BODY < <(request "GET" "/service-requests" "${JANE_BCEID_ONLY_WRONG_SUB_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests does not match by bceid_guid"
assert_json_field_equals "${BODY}" "total" "0" "matching bceid_guid with wrong sub returns no SRs"

read -r STATUS BODY < <(request "GET" "/service-requests?page=1&page_size=2" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests pagination returns 200"
assert_json_field_equals "${BODY}" "total" "4" "paginated total remains 4"
assert_json_field_equals "${BODY}" "page" "1" "paginated page is 1"
assert_json_field_equals "${BODY}" "page_size" "2" "paginated page_size is 2"

PAGE_ITEM_COUNT="$(json_len "${BODY}" "items")"
[[ "${PAGE_ITEM_COUNT}" == "2" ]] || fail "pagination: expected 2 items, got ${PAGE_ITEM_COUNT}"
pass "pagination limits item count"

read -r STATUS BODY < <(request "GET" "/service-requests" "${ALEX_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests for Alex returns 200"
assert_json_field_equals "${BODY}" "total" "3" "Alex Client sees 3 SRs"

read -r STATUS BODY < <(request "GET" "/service-requests" "${HARPER_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests for account-only user returns 200"
assert_json_field_equals "${BODY}" "total" "0" "Harper Client has no SRs"

echo
echo "Testing GET /service-requests/eligible-types..."

read -r STATUS BODY < <(request "GET" "/service-requests/eligible-types?case_status=OPEN" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests/eligible-types returns 200"

ELIGIBLE_COUNT="$(python3 - "${BODY}" <<'PY'
import json, sys
print(len(json.loads(sys.argv[1])))
PY
)"
[[ "${ELIGIBLE_COUNT}" == "19" ]] || fail "eligible types: expected 19, got ${ELIGIBLE_COUNT}"
pass "eligible types includes all 19 SR types"

FIRST_TYPE="$(python3 - "${BODY}" <<'PY'
import json, sys
print(json.loads(sys.argv[1])[0]["sr_type"])
PY
)"
[[ "${FIRST_TYPE}" == "ASSIST" ]] || fail "eligible types: expected first type ASSIST, got ${FIRST_TYPE}"
pass "eligible types response shape is valid"

echo
echo "Testing GET /service-requests/{sr_id}..."

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /service-requests/sr-001 for Jane returns 200"
assert_json_field_equals "${BODY}" "sr_id" "sr-001" "sr-001 detail id"
assert_json_field_equals "${BODY}" "sr_type" "ASSIST" "sr-001 detail type"
assert_json_field_equals "${BODY}" "client_name" "Jane Client" "sr-001 belongs to Jane"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001" "${ALEX_TOKEN}")
assert_status "${STATUS}" "404" "GET /service-requests/sr-001 for Alex returns 404"

read -r STATUS BODY < <(request "GET" "/service-requests/not-found" "${JANE_TOKEN}")
assert_status "${STATUS}" "404" "GET /service-requests/not-found returns 404"

echo
echo "Testing GET /service-requests/{sr_id}/draft..."

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/draft" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET draft for Jane Draft SR returns 200"
assert_json_field_equals "${BODY}" "sr_id" "sr-001" "draft sr_id"
assert_json_field_equals "${BODY}" "sr_type" "ASSIST" "draft sr_type"
assert_json_field_present "${BODY}" "draft_json" "draft_json present"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-014/draft" "${JANE_TOKEN}")
assert_status "${STATUS}" "404" "GET draft for non-Draft SR returns 404"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/draft" "${ALEX_TOKEN}")
assert_status "${STATUS}" "404" "GET draft for another user returns 404"

echo
echo "Testing GET /service-requests/{sr_id}/form..."

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/form?sr_type=ASSIST" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET generic form returns 200"
assert_json_field_equals "${BODY}" "form_type" "SR" "generic form type"
assert_json_field_equals "${BODY}" "sr_type" "ASSIST" "generic form SR type"
assert_json_field_equals "${BODY}" "total_pages" "2" "generic form total pages"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-014/form?sr_type=CRISIS_MED_TRANSPORT" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET crisis form returns 200"
assert_json_field_equals "${BODY}" "sr_type" "CRISIS_MED_TRANSPORT" "crisis form SR type"
assert_json_field_equals "${BODY}" "pages.0.fields.0.field_id" "amount_requested" "crisis form amount field"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/form?sr_type=BUS_PASS" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET bus pass form override returns 200"
assert_json_field_equals "${BODY}" "sr_type" "BUS_PASS" "bus pass form SR type"
assert_json_field_equals "${BODY}" "pages.0.fields.0.field_id" "needs_bus_pass" "bus pass form field"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-999/form" "${JANE_TOKEN}")
assert_status "${STATUS}" "404" "GET form for unknown SR returns 404"

echo
echo "Testing PUT /service-requests/{sr_id}/form..."

read -r STATUS BODY < <(request "PUT" "/service-requests/sr-001/form" "${JANE_TOKEN}" '{"page_index":1,"answers":{"description":"Updated mock form answer"}}')
assert_status "${STATUS}" "200" "PUT form for Draft SR returns 200"
assert_json_field_equals "${BODY}" "sr_id" "sr-001" "PUT form sr_id"
assert_json_field_equals "${BODY}" "draft_json.page_index" "1" "PUT form updates page_index"
assert_json_field_equals "${BODY}" "draft_json.answers.description" "Updated mock form answer" "PUT form updates answer"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET detail after PUT form returns 200"
assert_json_field_equals "${BODY}" "answers.description" "Updated mock form answer" "detail answers updated after PUT form"

read -r STATUS BODY < <(request "PUT" "/service-requests/sr-014/form" "${JANE_TOKEN}" '{"page_index":1,"answers":{"description":"Should fail"}}')
assert_status "${STATUS}" "404" "PUT form for non-Draft SR returns 404"

read -r STATUS BODY < <(request "PUT" "/service-requests/sr-001/form" "${JANE_TOKEN}" 'not-json')
assert_status "${STATUS}" "400" "PUT form with invalid JSON returns 400"

read -r STATUS BODY < <(request "PUT" "/service-requests/sr-001/form" "${ALEX_TOKEN}" '{"page_index":1,"answers":{"description":"Should not update"}}')
assert_status "${STATUS}" "404" "PUT form for another user's SR returns 404"

echo
echo "Testing POST /service-requests..."

read -r STATUS BODY < <(request "POST" "/service-requests" "${JANE_TOKEN}" '{"sr_type":"BUS_PASS"}')
assert_status "${STATUS}" "201" "POST /service-requests creates new Draft SR"
assert_json_field_equals "${BODY}" "sr_type" "BUS_PASS" "created SR type"
assert_json_field_present "${BODY}" "sr_id" "created SR has sr_id"
assert_json_field_present "${BODY}" "updated_at" "created SR has updated_at"

NEW_SR_ID="$(json_get "${BODY}" "sr_id")"

read -r STATUS BODY < <(request "POST" "/service-requests" "${JANE_TOKEN}" '{"sr_type":"BUS_PASS"}')
assert_status "${STATUS}" "409" "POST duplicate active SR type returns 409"

read -r STATUS BODY < <(request "POST" "/service-requests" "${JANE_TOKEN}" '{"sr_type":"NOT_A_TYPE"}')
assert_status "${STATUS}" "422" "POST invalid SR type returns 422"

read -r STATUS BODY < <(request "POST" "/service-requests" "${JANE_TOKEN}" 'not-json')
assert_status "${STATUS}" "400" "POST invalid JSON returns 400"

echo
echo "Testing POST /service-requests/{sr_id}/submit..."

read -r STATUS BODY < <(request "POST" "/service-requests/${NEW_SR_ID}/submit" "${JANE_TOKEN}" '{"pin":"0000","declaration_accepted":true}')
assert_status "${STATUS}" "403" "POST submit with invalid PIN returns 403"

read -r STATUS BODY < <(request "POST" "/service-requests/${NEW_SR_ID}/submit" "${JANE_TOKEN}" '{"pin":"1234","declaration_accepted":false}')
assert_status "${STATUS}" "400" "POST submit without declaration returns 400"

read -r STATUS BODY < <(request "POST" "/service-requests/${NEW_SR_ID}/submit" "${JANE_TOKEN}" 'not-json')
assert_status "${STATUS}" "400" "POST submit with invalid JSON returns 400"

read -r STATUS BODY < <(request "POST" "/service-requests/${NEW_SR_ID}/submit" "${ALEX_TOKEN}" '{"pin":"1234","declaration_accepted":true}')
assert_status "${STATUS}" "404" "POST submit for another user's SR returns 404"

read -r STATUS BODY < <(request "POST" "/service-requests/${NEW_SR_ID}/submit" "${JANE_TOKEN}" '{"pin":"1234","declaration_accepted":true}')
assert_status "${STATUS}" "200" "POST submit valid request returns 200"
assert_json_field_equals "${BODY}" "sr_id" "${NEW_SR_ID}" "submit response sr_id"
assert_json_field_present "${BODY}" "sr_number" "submit response sr_number"
assert_json_field_present "${BODY}" "submitted_at" "submit response submitted_at"

read -r STATUS BODY < <(request "GET" "/service-requests/${NEW_SR_ID}" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET submitted SR returns 200"
assert_json_field_equals "${BODY}" "status" "Submitted" "submitted SR status updated"

echo
echo "Testing POST /service-requests/{sr_id}/withdraw..."

read -r STATUS BODY < <(request "POST" "/service-requests" "${ALEX_TOKEN}" '{"sr_type":"BUS_PASS"}')
assert_status "${STATUS}" "201" "POST creates Alex withdraw test SR"
ALEX_NEW_SR_ID="$(json_get "${BODY}" "sr_id")"

read -r STATUS BODY < <(request "POST" "/service-requests/${ALEX_NEW_SR_ID}/withdraw" "${JANE_TOKEN}" '{"reason":"Wrong user"}')
assert_status "${STATUS}" "404" "POST withdraw for another user's SR returns 404"

read -r STATUS BODY < <(request "POST" "/service-requests/${ALEX_NEW_SR_ID}/withdraw" "${ALEX_TOKEN}" '{"reason":"No longer needed"}')
assert_status "${STATUS}" "204" "POST withdraw valid request returns 204"

read -r STATUS BODY < <(request "GET" "/service-requests/${ALEX_NEW_SR_ID}" "${ALEX_TOKEN}")
assert_status "${STATUS}" "200" "GET withdrawn SR returns 200"
assert_json_field_equals "${BODY}" "status" "Withdrawn" "withdrawn SR status updated"

read -r STATUS BODY < <(request "POST" "/service-requests/${ALEX_NEW_SR_ID}/withdraw" "${ALEX_TOKEN}" '{"reason":"Again"}')
assert_status "${STATUS}" "409" "POST withdraw already withdrawn SR returns 409"

read -r STATUS BODY < <(request "POST" "/service-requests/not-found/withdraw" "${ALEX_TOKEN}" '{"reason":"Missing"}')
assert_status "${STATUS}" "404" "POST withdraw unknown SR returns 404"

echo
echo "Testing Account endpoints..."

read -r STATUS BODY < <(request "GET" "/account/profile" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/profile returns 200"
assert_json_field_equals "${BODY}" "user_id" "client-001" "Jane profile user_id"
assert_json_field_equals "${BODY}" "email" "jane.client@example.com" "Jane profile email"
assert_json_field_equals "${BODY}" "case_number" "CASE-100001" "Jane profile case_number"
assert_json_field_equals "${BODY}" "case_status" "OPEN" "Jane profile case_status"

read -r STATUS BODY < <(request "GET" "/account/profile" "${JANE_WRONG_BCEID_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/profile ignores wrong bceid_guid claim"
assert_json_field_equals "${BODY}" "user_id" "client-001" "Jane profile user_id when bceid_guid is wrong"

read -r STATUS BODY < <(request "GET" "/account/profile" "${JANE_BCEID_ONLY_WRONG_SUB_TOKEN}")
assert_status "${STATUS}" "404" "GET /account/profile does not match by bceid_guid when sub is wrong"

read -r STATUS BODY < <(request "GET" "/account/profile" "${ALEX_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/profile for Alex returns 200"
assert_json_field_equals "${BODY}" "user_id" "client-002" "Alex profile user_id"
assert_json_field_equals "${BODY}" "case_number" "CASE-100002" "Alex profile case_number"

read -r STATUS BODY < <(request "GET" "/account/profile" "${HARPER_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/profile for account-only user returns 200"
assert_json_field_equals "${BODY}" "user_id" "client-014" "Harper profile user_id"
assert_json_field_equals "${BODY}" "case_number" "CASE-100014" "Harper profile case_number"

read -r STATUS BODY < <(request "GET" "/account/case-members" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/case-members returns 200"

CASE_MEMBER_COUNT="$(json_len "${BODY}" "members")"
[[ "${CASE_MEMBER_COUNT}" == "3" ]] || fail "case members: expected 3 Jane case members, got ${CASE_MEMBER_COUNT}"
pass "Jane case members count is 3"

assert_json_field_equals "${BODY}" "members.0.name" "Jane Client" "Jane first case member name"
assert_json_field_equals "${BODY}" "members.0.relationship" "Self" "Jane first case member relationship"
assert_json_field_equals "${BODY}" "members.1.name" "Elliot Client" "Jane second case member name"
assert_json_field_equals "${BODY}" "members.1.relationship" "Spouse" "Jane second case member relationship"
assert_json_field_equals "${BODY}" "members.2.name" "Sophie Client" "Jane third case member name"
assert_json_field_equals "${BODY}" "members.2.relationship" "Child" "Jane third case member relationship"

read -r STATUS BODY < <(request "POST" "/account/post-login-sync" "${JANE_TOKEN}" '{}')
assert_status "${STATUS}" "202" "POST /account/post-login-sync returns 202"
assert_json_field_equals "${BODY}" "status" "accepted" "post-login-sync response status"

read -r STATUS BODY < <(request "PATCH" "/account/contact" "${JANE_TOKEN}" '{"email":"updated.jane.client@example.com","email_confirm":"updated.jane.client@example.com","phones":[{"phone_number":"2505559999","phone_type":"CELL","operation":"UPDATE"}]}')
assert_status "${STATUS}" "200" "PATCH /account/contact returns 200"
assert_json_field_equals "${BODY}" "status" "ok" "PATCH contact response status"

read -r STATUS BODY < <(request "GET" "/account/profile" "${JANE_TOKEN}")
assert_status "${STATUS}" "200" "GET /account/profile after contact update returns 200"
assert_json_field_equals "${BODY}" "email" "updated.jane.client@example.com" "PATCH contact updated email"
assert_json_field_equals "${BODY}" "phone_numbers.0.phone_number" "2505559999" "PATCH contact updated phone number"
assert_json_field_equals "${BODY}" "phone_numbers.0.phone_type" "CELL" "PATCH contact updated phone type"

read -r STATUS BODY < <(request "PATCH" "/account/contact" "${JANE_TOKEN}" '{"email":"bad.jane.client@example.com","email_confirm":"different.jane.client@example.com"}')
assert_status "${STATUS}" "422" "PATCH /account/contact with mismatched email confirmation returns 422"

read -r STATUS BODY < <(request "PATCH" "/account/contact" "${JANE_TOKEN}" 'not-json')
assert_status "${STATUS}" "400" "PATCH /account/contact with invalid JSON returns 400"

MISSING_ACCOUNT_SUBJECT="$(md5_upper "Missing Account")"
MISSING_ACCOUNT_TOKEN="$(make_token "{\"sub\":\"${MISSING_ACCOUNT_SUBJECT}\",\"role\":\"CLIENT\",\"bceid_guid\":\"BCEID:Missing Account\"}")"

read -r STATUS BODY < <(request "GET" "/account/profile" "${MISSING_ACCOUNT_TOKEN}")
assert_status "${STATUS}" "404" "GET /account/profile for missing account returns 404"

read -r STATUS BODY < <(request "GET" "/account/case-members" "${MISSING_ACCOUNT_TOKEN}")
assert_status "${STATUS}" "404" "GET /account/case-members for missing account returns 404"

read -r STATUS BODY < <(request "PATCH" "/account/contact" "${MISSING_ACCOUNT_TOKEN}" '{"email":"missing@example.com","email_confirm":"missing@example.com"}')
assert_status "${STATUS}" "404" "PATCH /account/contact for missing account returns 404"

echo
echo "Testing method errors..."

read -r STATUS BODY < <(request "DELETE" "/service-requests" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "DELETE /service-requests returns 405"

read -r STATUS BODY < <(request "POST" "/service-requests/sr-001" "${JANE_TOKEN}" '{}')
assert_status "${STATUS}" "405" "POST /service-requests/{sr_id} returns 405"

read -r STATUS BODY < <(request "POST" "/service-requests/sr-001/draft" "${JANE_TOKEN}" '{}')
assert_status "${STATUS}" "405" "POST /service-requests/{sr_id}/draft returns 405"

read -r STATUS BODY < <(request "DELETE" "/service-requests/sr-001/form" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "DELETE /service-requests/{sr_id}/form returns 405"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/submit" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "GET /service-requests/{sr_id}/submit returns 405"

read -r STATUS BODY < <(request "GET" "/service-requests/sr-001/withdraw" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "GET /service-requests/{sr_id}/withdraw returns 405"

read -r STATUS BODY < <(request "POST" "/account/profile" "${JANE_TOKEN}" '{}')
assert_status "${STATUS}" "405" "POST /account/profile returns 405"

read -r STATUS BODY < <(request "GET" "/account/contact" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "GET /account/contact returns 405"

read -r STATUS BODY < <(request "POST" "/account/case-members" "${JANE_TOKEN}" '{}')
assert_status "${STATUS}" "405" "POST /account/case-members returns 405"

read -r STATUS BODY < <(request "GET" "/account/post-login-sync" "${JANE_TOKEN}")
assert_status "${STATUS}" "405" "GET /account/post-login-sync returns 405"

echo
echo "Testing non-implemented endpoints..."

read -r STATUS BODY < <(request "GET" "/monthly-reports" "")
assert_status "${STATUS}" "501" "GET /monthly-reports returns 501"
assert_body_contains "${BODY}" "Not implemented in this mock" "501 response body"

read -r STATUS BODY < <(request "GET" "/admin/support-view/client-data/service-requests" "${ADMIN_TOKEN}")
assert_status "${STATUS}" "501" "admin support-view service-requests remains unimplemented"

echo
echo "All tests passed."