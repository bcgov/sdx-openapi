terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "~> 5.0"
    }
  }
}

provider "keycloak" {
  client_id = var.keycloak_client_id
  username  = var.keycloak_username
  password  = var.keycloak_password
  url       = var.keycloak_url
}

# ─────────────────────────────────────────────
# Realm
# ─────────────────────────────────────────────

resource "keycloak_realm" "poc" {
  realm   = var.realm_name
  enabled = true

  display_name = "POC Realm"

  access_token_lifespan        = "5m"
  sso_session_idle_timeout     = "30m"
  sso_session_max_lifespan     = "10h"
  offline_session_idle_timeout = "720h"
  offline_session_max_lifespan = "1440h"
}

