output "client_id" {
  description = "OIDC app registration client ID for this environment."
  value       = azuread_application.this.client_id
}
