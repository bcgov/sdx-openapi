# ─────────────────────────────────────────────
# Client: client-a
# ─────────────────────────────────────────────

resource "keycloak_openid_client" "client_a" {
  realm_id  = keycloak_realm.poc.id
  client_id = "client-a"
  name      = "Client A"
  enabled   = true

  access_type                  = "CONFIDENTIAL"
  service_accounts_enabled     = true
  standard_flow_enabled        = true
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  consent_required             = true

  valid_redirect_uris = ["https://oauth.usebruno.com/callback", "http://*"]
}

resource "keycloak_openid_client_default_scopes" "client_a_default_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.client_a.id

  default_scopes = [
    "service_account",
    keycloak_openid_client_scope.ppid_sector_a.name,
  ]

}

resource "keycloak_openid_client_optional_scopes" "client_a_optional_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.client_a.id

  optional_scopes = [
    keycloak_openid_client_scope.read_finance.name,
    keycloak_openid_client_scope.write_finance.name,
    keycloak_openid_client_scope.read_health.name,
    keycloak_openid_client_scope.phn_lookup.name,
  ]

}

# Audience mapper for client-a → targets kong-gw
resource "keycloak_openid_audience_protocol_mapper" "client_a_audience" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.client_a.id
  name      = "audience-kong-gw"

  included_client_audience = keycloak_openid_client.kong_gw.client_id
  add_to_access_token      = true
  add_to_id_token          = false
}

