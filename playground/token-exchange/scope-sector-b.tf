resource "keycloak_openid_client_scope" "ppid_sector_b" {
  realm_id               = keycloak_realm.poc.id
  name                   = "ppid_sector_b"
  description            = "PPID scope for sector B"
  include_in_token_scope = true
}

resource "keycloak_generic_protocol_mapper" "ppid_sector_b_mapper" {
  realm_id        = keycloak_realm.poc.id
  client_scope_id = keycloak_openid_client_scope.ppid_sector_b.id
  name            = "pairwise-subject"
  protocol        = "openid-connect"
  protocol_mapper = "oidc-sha256-pairwise-sub-mapper"

  config = {
    "sectorIdentifierUri"      = "https://sector-b.local/sector-b.json"
    "pairwiseSubAlgorithmSalt" = "12321321-c1ad-4dd5-b5eb-ed32b160891e"
  }
}
