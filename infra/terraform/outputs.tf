output "azure_tenant_id" {
  description = "Azure AD tenant ID (same for all environments)."
  value       = data.azuread_client_config.current.tenant_id
}

output "azure_subscription_id" {
  description = "Azure subscription ID (same for all environments)."
  value       = data.azurerm_subscription.current.subscription_id
}

output "function_app_names" {
  description = "Map of environment -> Function App name (GitHub var AZURE_FUNCTIONAPP_NAME)."
  value       = { for k, m in module.app : k => m.function_app_name }
}

output "function_app_hostnames" {
  description = "Map of environment -> public Function App hostname."
  value       = { for k, m in module.app : k => m.function_app_default_hostname }
}

output "azure_client_ids" {
  description = "Map of environment -> OIDC client ID (GitHub var AZURE_CLIENT_ID)."
  value       = { for k, m in module.oidc : k => m.client_id }
}

output "entra_spa_client_ids" {
  description = "Map of environment -> SPA app registration client ID (frontend VITE_ENTRA_SPA_CLIENT_ID)."
  value       = { for k, m in module.auth : k => m.spa_client_id }
}

output "entra_api_client_ids" {
  description = "Map of environment -> API app registration client ID (the token audience)."
  value       = { for k, m in module.auth : k => m.api_client_id }
}

output "entra_api_scopes" {
  description = "Map of environment -> scope string MSAL requests (frontend VITE_ENTRA_API_SCOPE)."
  value       = { for k, m in module.auth : k => m.api_scope }
}

output "key_vault_urls" {
  description = "Map of environment -> Key Vault URI holding the teacher-emails secret."
  value       = { for k, m in module.auth : k => m.key_vault_url }
}
