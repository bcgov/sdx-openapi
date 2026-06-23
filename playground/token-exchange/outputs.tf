output "realm_id" {
  description = "ID of the created realm"
  value       = keycloak_realm.poc.id
}

output "client_a_id" {
  description = "Client ID for client-a"
  value       = keycloak_openid_client.client_a.client_id
}

output "client_a_secret" {
  description = "Client secret for client-a"
  value       = keycloak_openid_client.client_a.client_secret
  sensitive   = true
}

output "kong_gw_id" {
  description = "Client ID for kong-gw"
  value       = keycloak_openid_client.kong_gw.client_id
}

output "kong_gw_secret" {
  description = "Client secret for kong-gw"
  value       = keycloak_openid_client.kong_gw.client_secret
  sensitive   = true
}

# output "client_b_id" {
#   description = "Client ID for client-b"
#   value       = keycloak_openid_client.client_b.client_id
# }

# output "client_b_secret" {
#   description = "Client secret for client-b"
#   value       = keycloak_openid_client.client_b.client_secret
#   sensitive   = true
# }
