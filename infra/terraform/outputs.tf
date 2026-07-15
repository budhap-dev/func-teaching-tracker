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
