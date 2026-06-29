# Token Exchange POC — Keycloak + Terraform

This directory contains a Terraform configuration that provisions a Keycloak realm with two OIDC clients (`client-a`, `kong-gw`) and a `Dockerfile` to run Keycloak locally.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.0
- `jq`
- [oauth2c](https://github.com/SecureAuthCorp/oauth2c)

---

## 1. Run Keycloak

### Build and start

```bash
docker build -t keycloak-poc .

docker run --rm \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  --name keycloak-poc \
  keycloak-poc
```

Keycloak will be available at **http://localhost:8080**.
Admin console: **http://localhost:8080/admin** (credentials: `admin` / `admin`).

> **Note:** The container uses an in-memory H2 database (`dev-file` mode). Data is lost when the container stops. This is intentional for local development.

---

## 2. Apply Terraform

### Configure variables

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` if needed (defaults match the Docker setup above):

```hcl
keycloak_url      = "http://localhost:8080"
keycloak_username = "admin"
keycloak_password = "admin"
realm_name        = "poc-realm"
```

### Initialize and apply

```bash
terraform init
terraform apply
```

Terraform will create:

| Resource                                                                                             | Description                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `poc-realm`                                                                                          | Keycloak realm (`access_token_lifespan = 5m`)                                                                                                                                      |
| `fin:finance:read`, `fin:finance:write`, `hth:patient:read`, `hth:patient:phn:read`, `hth:superuser` | Domain client scopes (included in token scope)                                                                                                                                     |
| `ppid_sector_a`, `ppid_sector_b`                                                                     | PPID client scopes, each with a SHA-256 pairwise subject (`sub`) mapper for its sector                                                                                             |
| `client-a`                                                                                           | Confidential client; standard flow + service accounts enabled. Default scopes: `ppid_sector_a`; optional scopes: the four `fin:`/`hth:` domain scopes; audience mapper → `kong-gw` |
| `kong-gw`                                                                                            | Confidential service-account client with standard token exchange enabled. Optional scopes: all domain scopes + `ppid_sector_a` + `ppid_sector_b`                                   |
| `testuser`                                                                                           | Test realm user (password `secret`)                                                                                                                                                |

---

### Testing

#### Emulate a user login to client-a

```sh
export SECRET=$(terraform output client_a_secret | jq -r .)

# User: testuser, Pass: secret
oauth2c "http://localhost:8080/realms/poc-realm/.well-known/openid-configuration" \
  --client-id client-a \
  --client-secret $SECRET \
  --response-types code \
  --response-mode query \
  --auth-method client_secret_basic \
  --grant-type authorization_code \
  --scopes "fin:finance:read fin:finance:write hth:patient:read hth:patient:phn:read" \
  | jq -r .access_token

export TOK="<access token>"
```

The access token has:

- `aud` is "kong-gw"
- `scope` is "hth:patient:phn:read hth:patient:read fin:finance:write ppid_sector_a fin:finance:read"

#### Emulate Kong API Gateway token exchange

Token exchange will do the following before sending to the API provider (resource server):

- downscope to just `fin:finance:read fin:finance:write`
- change the `sub`
- remove `aud`

```sh

export KONG_SECRET=$(terraform output kong_gw_secret | jq -r .)

oauth2c "http://localhost:8080/realms/poc-realm/.well-known/openid-configuration" \
  --client-id kong-gw \
  --client-secret $KONG_SECRET \
  --grant-type urn:ietf:params:oauth:grant-type:token-exchange \
  --auth-method client_secret_basic \
  --subject-token $TOK \
  --audience "" \
  --subject-token-type urn:ietf:params:oauth:token-type:access_token \
  --scopes ppid_sector_b,fin:finance:read,fin:finance:write \
  | jq -r .access_token
```

> Observe change in `sub`, reduced scope and no `aud`

## 3. Tear down

Destroy Terraform-managed resources (while Keycloak is still running):

```bash
terraform destroy
```

Stop Keycloak (data is discarded automatically):

```bash
docker stop keycloak-poc
```
