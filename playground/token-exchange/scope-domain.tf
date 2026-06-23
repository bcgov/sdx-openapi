
# ─────────────────────────────────────────────
# Client Scopes
# ─────────────────────────────────────────────

resource "keycloak_openid_client_scope" "read_finance" {
  realm_id               = keycloak_realm.poc.id
  name                   = "fin:finance:read"
  description            = "Grants read access to the finance API"
  include_in_token_scope = true
}

resource "keycloak_openid_client_scope" "write_finance" {
  realm_id               = keycloak_realm.poc.id
  name                   = "fin:finance:write"
  description            = "Grants write access to the finance API"
  include_in_token_scope = true
}

resource "keycloak_openid_client_scope" "read_health" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:patient:read"
  description            = "Grants read access to the health API"
  include_in_token_scope = true
}

resource "keycloak_openid_client_scope" "phn_lookup" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:patient:phn:lookup"
  description            = "Grants access to the PHN lookup API"
  include_in_token_scope = true
}

resource "keycloak_openid_client_scope" "superuser" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:superuser"
  description            = "Grants superuser access to the health services"
  include_in_token_scope = true
}
