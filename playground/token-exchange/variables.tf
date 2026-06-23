variable "keycloak_url" {
  description = "Base URL of the Keycloak server (e.g. http://localhost:8080)"
  type        = string
}

variable "keycloak_client_id" {
  description = "Client ID used to authenticate with Keycloak (typically 'admin-cli')"
  type        = string
  default     = "admin-cli"
}

variable "keycloak_username" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "keycloak_password" {
  description = "Keycloak admin password"
  type        = string
  sensitive   = true
}

variable "realm_name" {
  description = "Name of the Keycloak realm to create"
  type        = string
  default     = "poc-realm"
}
