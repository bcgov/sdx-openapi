# ─────────────────────────────────────────────
# Client: kong-gw
# ─────────────────────────────────────────────

resource "keycloak_openid_client" "kong_gw" {
  realm_id  = keycloak_realm.poc.id
  client_id = "kong-gw"
  name      = "Kong Gateway"
  enabled   = true

  access_type                     = "CONFIDENTIAL"
  service_accounts_enabled        = true
  standard_flow_enabled           = false
  implicit_flow_enabled           = false
  direct_access_grants_enabled    = false
  standard_token_exchange_enabled = true

  valid_redirect_uris = []
}

resource "keycloak_openid_client_optional_scopes" "kong_gw_optional_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.kong_gw.id

  optional_scopes = [
    keycloak_openid_client_scope.read_finance.name,
    keycloak_openid_client_scope.write_finance.name,
    keycloak_openid_client_scope.read_health.name,
    keycloak_openid_client_scope.phn_lookup.name,
    keycloak_openid_client_scope.ppid_sector_a.name,
    keycloak_openid_client_scope.ppid_sector_b.name,
  ]
}

resource "keycloak_openid_client_default_scopes" "kong_gw_default_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.kong_gw.id

  default_scopes = [
    "service_account",
  ]
}

# Audience mapper for kong-gw → self-referential (so tokens are valid for this client)
# resource "keycloak_openid_audience_protocol_mapper" "kong_gw_audience" {
#   realm_id  = keycloak_realm.poc.id
#   client_id = keycloak_openid_client.kong_gw.id
#   name      = "audience-kong-gw-self"

#   included_client_audience = keycloak_openid_client.kong_gw.client_id
#   add_to_access_token      = true
#   add_to_id_token          = false
# }

# Audience mapper for kong-gw → client-b
# resource "keycloak_openid_audience_protocol_mapper" "kong_gw_audience_client_b" {
#   realm_id  = keycloak_realm.poc.id
#   client_id = keycloak_openid_client.kong_gw.id
#   name      = "audience-kong-gw-client-b"

#   included_client_audience = keycloak_openid_client.client_b.client_id
#   add_to_access_token      = true
#   add_to_id_token          = false
# }
