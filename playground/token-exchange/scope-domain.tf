
# ─────────────────────────────────────────────
# Client Scopes
# ─────────────────────────────────────────────

resource "keycloak_openid_client_scope" "read_finance" {
  realm_id               = keycloak_realm.poc.id
  name                   = "fin:finance:read"
  description            = "Grants read access to the finance API"
  include_in_token_scope = true

  consent_screen_text = "Grants read access to your finance data"
  gui_order           = 10

}

resource "keycloak_openid_client_scope" "write_finance" {
  realm_id               = keycloak_realm.poc.id
  name                   = "fin:finance:write"
  description            = "Grants write access to the finance API"
  include_in_token_scope = true
  consent_screen_text    = "Grants write access to your finance data"
  gui_order              = 20
}

resource "keycloak_openid_client_scope" "read_health" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:patient:read"
  description            = "Grants read access to the health API"
  include_in_token_scope = true
  consent_screen_text    = "Grants read access to your health data"
  gui_order              = 30
}

resource "keycloak_openid_client_scope" "phn_lookup" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:patient:phn:read"
  description            = "Grants access to the PHN lookup API"
  include_in_token_scope = true
  consent_screen_text    = "Grants read access to your PHN"
  gui_order              = 40
}

resource "keycloak_openid_client_scope" "superuser" {
  realm_id               = keycloak_realm.poc.id
  name                   = "hth:superuser"
  description            = "Grants superuser access to the health services"
  include_in_token_scope = true
  consent_screen_text    = "Grants access to all your health data"
  gui_order              = 50
}
