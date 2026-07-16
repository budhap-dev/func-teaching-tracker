output "resource_group_id" {
  value = azurerm_resource_group.this.id
}

output "resource_group_name" {
  value = azurerm_resource_group.this.name
}

output "function_app_name" {
  value = azurerm_function_app_flex_consumption.this.name
}

output "function_app_default_hostname" {
  value = azurerm_function_app_flex_consumption.this.default_hostname
}

output "principal_id" {
  description = "Object ID of the app's system-assigned managed identity."
  value       = azurerm_function_app_flex_consumption.this.identity[0].principal_id
}
