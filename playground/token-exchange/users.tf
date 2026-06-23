# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────

resource "keycloak_user" "test_user" {
  realm_id = keycloak_realm.poc.id
  username = "testuser"
  enabled  = true

  email      = "testuser@example.com"
  first_name = "Test"
  last_name  = "User"

  initial_password {
    value     = "secret"
    temporary = false
  }
}
