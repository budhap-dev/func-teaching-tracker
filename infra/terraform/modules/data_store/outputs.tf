output "storage_account_id" {
  value = azurerm_storage_account.this.id
}

output "storage_account_name" {
  value = azurerm_storage_account.this.name
}

output "table_endpoint" {
  description = "Table service URL — the app's DATA_TABLES_URL."
  value       = azurerm_storage_account.this.primary_table_endpoint
}
