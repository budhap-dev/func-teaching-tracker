output "api_client_id" {
  description = "Client ID of the API app registration — the token audience the Function validates."
  value       = azuread_application.api.client_id
}

output "spa_client_id" {
  description = "Client ID of the SPA app registration — MSAL's clientId (frontend VITE_ENTRA_SPA_CLIENT_ID)."
  value       = azuread_application.spa.client_id
}

output "api_scope" {
  description = "Full scope string MSAL requests (frontend VITE_ENTRA_API_SCOPE)."
  value       = "api://${azuread_application.api.client_id}/access_as_teacher"
}

output "key_vault_id" {
  description = "Vault resource ID (for role assignments)."
  value       = azurerm_key_vault.this.id
}

output "key_vault_url" {
  description = "Vault URI the Function reads the teacher-emails secret from."
  value       = azurerm_key_vault.this.vault_uri
}
