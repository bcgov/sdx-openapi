# ─────────────────────────────────────────────
# Client: client-b
# ─────────────────────────────────────────────

resource "keycloak_openid_client" "client_b" {
  realm_id  = keycloak_realm.poc.id
  client_id = "client-b"
  name      = "Client B"
  enabled   = true

  access_type                  = "CONFIDENTIAL"
  service_accounts_enabled     = true
  standard_flow_enabled        = false
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false

  valid_redirect_uris = []

  extra_config = {
    "subject_type" : "pairwise",
    "sector.identifier.uri" : "https://sector-b.local/sector-b.json",
  }
}

resource "keycloak_openid_client_default_scopes" "client_b_default_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.client_b.id

  default_scopes = [
    keycloak_openid_client_scope.ppid_sector_b.name,
  ]
}

resource "keycloak_openid_client_optional_scopes" "client_b_optional_scopes" {
  realm_id  = keycloak_realm.poc.id
  client_id = keycloak_openid_client.client_b.id

  optional_scopes = [
    keycloak_openid_client_scope.read_finance.name,
    keycloak_openid_client_scope.write_finance.name
  ]

}

# Audience mapper for client-b → targets kong-gw
# resource "keycloak_openid_audience_protocol_mapper" "client_b_audience" {
#   realm_id  = keycloak_realm.poc.id
#   client_id = keycloak_openid_client.client_b.id
#   name      = "audience-kong-gw"

#   included_client_audience = keycloak_openid_client.kong_gw.client_id
#   add_to_access_token      = true
#   add_to_id_token          = false
# }
