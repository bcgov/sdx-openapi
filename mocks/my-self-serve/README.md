# My Self Serve Mock

## Building

### AI Prompt

- only look for files in the /mocks directory
- follow the example structure provided by /mocks/data-usage-service and /mocks/phn-lookup
- all code must be in a single `main.ts` typescript file
- use Deno
- use sqlite database
- use `jsr:@std/yaml` for yaml handling
- create database if it does not exist
- do not use any environment variables
- serve on port 8000
- put database at `./data/sqlite.db`
- use the `openapi.yaml` OpenAPI spec for details about the operations and the entity
- build mock implementations for the Service Requests and Account endpoints
- return `501 Not Implemented` for all other endpoints, except `GET /health` and `PUT /data`
- require a Bearer token for `PUT /data`
- import Service Request and Account data from the same `data/import.yaml` file
- associate each Service Request and Account with a client identity
- when importing data, calculate `subject` from `client_name` when it is not provided
- calculate `subject` as an MD5 hash of `client_name`, uppercase, with no dashes
- when importing data, calculate `bceid_guid` from `client_name` when it is not provided
- calculate `bceid_guid` as the string `BCEID:` plus `client_name`
- for client-scoped API calls, match only by the token `sub` claim
- do not match client-scoped API calls by the token `bceid_guid` claim
- include sample data in the `data/import.yaml` file

## Deployment

```sh
helm upgrade --install my-self-serve-mock \
  --set fullnameOverride=my-self-serve-mock \
  -f chart.yaml \
  --set-file "config[0].contents=main.ts" \
  bcgov/generic-api
```

After updating the Helm deployment, re-import `data/import.yaml`. The database
contents are not updated by Helm.

## Testing the API

## Requirements

- [deno](https://docs.deno.com/runtime/getting_started/installation/)

### Running the API

```sh
deno run --allow-net --allow-read --allow-write main.ts
```

### Create an import token

The import endpoint requires a Bearer token. No specific role is required.

```sh
IMPORT_PAYLOAD=$(printf '{"sub":"import-user","role":"ADMIN","idir_username":"mockadmin"}' \
  | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')

IMPORT_TOKEN="header.${IMPORT_PAYLOAD}.sig"
```

### Importing data

```sh
curl -s http://localhost:8000/data \
  -X PUT \
  -H "Authorization: Bearer ${IMPORT_TOKEN}" \
  --data-binary @data/import.yaml
```

The import is a full replacement. Existing Service Request and Account records
are deleted and replaced with the records from `data/import.yaml`.

The import file contains both top-level sections:

```yaml
accounts:
  - client_name: Jane Client
    user_id: client-001
    email: jane.client@example.com
    phone_numbers:
      - phone_number: "2505550101"
        phone_type: CELL
    case_number: CASE-100001
    case_status: OPEN
    case_members:
      - name: Jane Client
        relationship: Self

service_requests:
  - sr_id: sr-001
    sr_type: ASSIST
    sr_number: SR-100001
    status: Draft
    client_name: Jane Client
    created_at: "2026-04-01T16:00:00Z"
    updated_at: "2026-04-01T16:10:00Z"
    draft_json:
      page_index: 0
      answers:
        description: Request for general assistance with monthly support.
    answers_json:
      description: Request for general assistance with monthly support.
    attachments: []
```

The import data should not need to provide `subject` or `bceid_guid`.

When `subject` is missing, the mock calculates it from `client_name` as:

```text
MD5(client_name), uppercase, no dashes
```

When `bceid_guid` is missing, the mock calculates it from `client_name` as:

```text
BCEID:<client_name>
```

For example:

```text
client_name = Jane Client
subject = 2950834C7EBD7D19C4B79783A46631DC
bceid_guid = BCEID:Jane Client
```

### Running the automated test script

The mock includes a bash test script that starts the API, imports seed data, and
runs success and failure tests for the implemented endpoints.

```sh
chmod +x test-my-self-serve.sh
./test-my-self-serve.sh
```

The script validates:

```text
GET  /health
PUT  /data

GET  /service-requests
POST /service-requests
GET  /service-requests/eligible-types
GET  /service-requests/{sr_id}
GET  /service-requests/{sr_id}/draft
GET  /service-requests/{sr_id}/form
PUT  /service-requests/{sr_id}/form
POST /service-requests/{sr_id}/submit
POST /service-requests/{sr_id}/withdraw

GET   /account/profile
PATCH /account/contact
GET   /account/case-members
POST  /account/post-login-sync

401 responses for missing or invalid auth
401 responses for client-scoped tokens without a sub claim
404 responses for missing or cross-user Service Requests
404 responses for missing accounts
405 responses for unsupported methods on implemented routes
501 responses for unimplemented endpoints
sub-based matching only; bceid_guid is not used for request matching
```

The script expects to be run from this directory:

```sh
cd mocks/my-self-serve
./test-my-self-serve.sh
```

To run the test script against a deployed mock, start a port-forward in one
terminal:

```sh
oc port-forward deploy/my-self-serve-mock 8080:8000
```

Then run the script from another terminal:

```sh
BASE_URL=http://localhost:8080 ./test-my-self-serve.sh
```

When `BASE_URL` is not `http://localhost:8000`, the script does not start a
local Deno server. It checks the existing API at `BASE_URL`.

### Client test users

The import data contains these client names with Service Request data:

```text
Jane Client
Alex Client
Morgan Client
Priya Client
Sam Client
Lee Client
Taylor Client
Chris Client
Jordan Client
Casey Client
Riley Client
Avery Client
Quinn Client
```

The import data also contains these account-only clients with no Service Request data:

```text
Harper Client
Devon Client
Rowan Client
```

To query records for a client, create a token with:

```text
sub = MD5(client_name), uppercase, no dashes
```

Client-scoped endpoints match only against the token `sub` claim.

The token `bceid_guid` claim is not used for client request matching. A token
with a matching `bceid_guid` and a non-matching `sub` will not return that
client's records.

Example for `Jane Client`:

```sh
JANE_SUB=$(printf 'Jane Client' | md5sum | awk '{print toupper($1)}')

JANE_PAYLOAD=$(printf '{"sub":"%s","role":"CLIENT","bceid_guid":"BCEID:Jane Client"}' "${JANE_SUB}" \
  | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')

JANE_TOKEN="header.${JANE_PAYLOAD}.sig"
```

Example for `Alex Client`:

```sh
ALEX_SUB=$(printf 'Alex Client' | md5sum | awk '{print toupper($1)}')

ALEX_PAYLOAD=$(printf '{"sub":"%s","role":"CLIENT","bceid_guid":"BCEID:Alex Client"}' "${ALEX_SUB}" \
  | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')

ALEX_TOKEN="header.${ALEX_PAYLOAD}.sig"
```

Example showing that `bceid_guid` does not grant access when `sub` does not
match:

```sh
WRONG_SUB_PAYLOAD=$(printf '{"sub":"wrong-subject","role":"CLIENT","bceid_guid":"BCEID:Jane Client"}' \
  | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')

WRONG_SUB_TOKEN="header.${WRONG_SUB_PAYLOAD}.sig"

curl -s -H "Authorization: Bearer ${WRONG_SUB_TOKEN}" \
  http://localhost:8000/service-requests
```

This returns `200` with an empty result set.

### Service Request GET calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  http://localhost:8000/service-requests
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  "http://localhost:8000/service-requests?page=1&page_size=20"
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  "http://localhost:8000/service-requests/eligible-types?case_status=OPEN"
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  http://localhost:8000/service-requests/sr-001
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  http://localhost:8000/service-requests/sr-001/draft
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  "http://localhost:8000/service-requests/sr-001/form?sr_type=ASSIST"
```

### Service Request POST calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/service-requests \
  -X POST \
  -d '{"sr_type":"BUS_PASS"}'
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/service-requests/sr-001/submit \
  -X POST \
  -d '{"pin":"1234","declaration_accepted":true}'
```

```sh
curl -i -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/service-requests/sr-001/withdraw \
  -X POST \
  -d '{"reason":"No longer needed"}'
```

### Service Request PUT calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/service-requests/sr-001/form \
  -X PUT \
  -d '{"page_index":1,"answers":{"description":"Updated mock form answer"}}'
```

### Account GET calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  http://localhost:8000/account/profile
```

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  http://localhost:8000/account/case-members
```

### Account PATCH calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/account/contact \
  -X PATCH \
  -d '{
    "email": "updated.jane.client@example.com",
    "email_confirm": "updated.jane.client@example.com",
    "phones": [
      {
        "phone_number": "2505559999",
        "phone_type": "CELL",
        "operation": "UPDATE"
      }
    ]
  }'
```

### Account POST calls

```sh
curl -s -H "Authorization: Bearer ${JANE_TOKEN}" \
  -H "Content-Type: application/json" \
  http://localhost:8000/account/post-login-sync \
  -X POST
```

### Auth checks

A client-scoped endpoint without a Bearer token returns `401`.

```sh
curl -i http://localhost:8000/service-requests
```

A client-scoped endpoint with a token that does not contain `sub` returns `401`.

```sh
NO_SUB_PAYLOAD=$(printf '{"role":"CLIENT","bceid_guid":"BCEID:Jane Client"}' \
  | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')

NO_SUB_TOKEN="header.${NO_SUB_PAYLOAD}.sig"

curl -i -H "Authorization: Bearer ${NO_SUB_TOKEN}" \
  http://localhost:8000/service-requests
```

The import endpoint without a Bearer token returns `401`.

```sh
curl -i http://localhost:8000/data \
  -X PUT \
  --data-binary @data/import.yaml
```

The import endpoint with any valid Bearer token is allowed.

```sh
curl -i http://localhost:8000/data \
  -X PUT \
  -H "Authorization: Bearer ${JANE_TOKEN}" \
  --data-binary @data/import.yaml
```

### Not implemented endpoints

```sh
curl -i http://localhost:8000/monthly-reports
```