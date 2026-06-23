# Token Exchange POC — Keycloak + Terraform

This directory contains a Terraform configuration that provisions a Keycloak realm with three OIDC clients (`client-a`, `kong-gw`, `client-b`) and a `Dockerfile` to run Keycloak locally.

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
  keycloak-poc --log-level="debug"
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

| Resource                              | Description                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `poc-realm`                           | Keycloak realm                                                                                          |
| `api:access`, `api:read`, `api:write` | Custom client scopes                                                                                    |
| `client-a`                            | Confidential service-account client; scopes: `api:access`, `api:read`; audience: `kong-gw`              |
| `kong-gw`                             | Confidential service-account client; scope: `api:access`; self-referential audience                     |
| `client-b`                            | Confidential service-account client; scopes: `api:access`, `api:read`, `api:write`; audience: `kong-gw` |

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
  --scopes "fin:finance:read fin:finance:write hth:patient:read hth:patient:phn:lookup" \
  | jq -r .access_token

export TOK="<access token>"
```

#### Emulate Kong API Gateway token exchange

The access token has scopes for `fin` and `hth` APIs.

Token exchange will downscope to just `fin:finance:read fin:finance:write`,
before passing to the resource server.

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
  --scopes fin:finance:read,fin:finance:write \
  | jq -r .access_token
```

## 3. Tear down

Destroy Terraform-managed resources (while Keycloak is still running):

```bash
terraform destroy
```

Stop Keycloak (data is discarded automatically):

```bash
docker stop keycloak-poc
```
