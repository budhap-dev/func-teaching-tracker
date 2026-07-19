data "azuread_client_config" "current" {}
data "azurerm_subscription" "current" {}

# One isolated Function App stack (RG, storage, App Insights, plan) per environment.
module "app" {
  source   = "./modules/function_app"
  for_each = var.environments

  project                = var.project
  env                    = each.key
  location               = each.value.location
  node_version           = each.value.node_version
  instance_memory_in_mb  = each.value.instance_memory_in_mb
  maximum_instance_count = each.value.maximum_instance_count
  cors_allowed_origins   = each.value.cors_allowed_origins
  tags                   = merge(var.tags, { environment = each.key })

  # REQ-004: how the API validates teacher tokens and finds the allow-list.
  # REQ-009: where it persists data (memory | tables) and the table endpoint.
  extra_app_settings = {
    TENANT_ID       = data.azuread_client_config.current.tenant_id
    API_CLIENT_ID   = module.auth[each.key].api_client_id
    KEY_VAULT_URL   = module.auth[each.key].key_vault_url
    AUTH_ENFORCED   = tostring(each.value.auth_enforced)
    DATA_STORE      = each.value.data_store
    DATA_TABLES_URL = module.data[each.key].table_endpoint
  }
}

# REQ-009: per-environment durable data store (UK South, keyless). Provisions
# the account only — the four tables are created by the seeder over AAD, since
# a keyless account cannot be written by Terraform's data plane. DATA_STORE
# stays "memory" until an env's tables are seeded and its flag flipped.
module "data" {
  source   = "./modules/data_store"
  for_each = var.environments

  project  = var.project
  env      = each.key
  location = each.value.location
  tags     = merge(var.tags, { environment = each.key })
}

# The Function App reads and writes the data tables with its managed identity;
# the deployer gets the same role so it can create tables and run the seeder.
# Placed at root (not in-module) for the same reason as func_reads_secrets: it
# needs the app's identity and the data account together.
resource "azurerm_role_assignment" "func_writes_data" {
  for_each = var.environments

  scope                = module.data[each.key].storage_account_id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = module.app[each.key].principal_id
}

resource "azurerm_role_assignment" "deployer_writes_data" {
  for_each = var.environments

  scope                = module.data[each.key].storage_account_id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = data.azuread_client_config.current.object_id
}

# REQ-004: per-environment Entra app registrations (API + SPA) and the Key
# Vault holding the teacher-emails allow-list.
module "auth" {
  source   = "./modules/teacher_auth"
  for_each = var.environments

  project            = var.project
  env                = each.key
  location           = each.value.location
  tenant_id          = data.azuread_client_config.current.tenant_id
  deployer_object_id = data.azuread_client_config.current.object_id
  teacher_emails     = var.teacher_emails

  # The SPA redirects back to the environment's frontend — the same origins
  # CORS already allows. Local `npm start` signs in against dev only.
  spa_redirect_uris = concat(
    each.value.cors_allowed_origins,
    each.key == "dev" ? ["http://localhost:3000"] : [],
  )

  tags = merge(var.tags, { environment = each.key })
}

# The Function App reads the teacher-emails secret with its managed identity.
# Lives here, not in the module: the app needs auth outputs (settings) and the
# vault needs the app's identity — in-module this would be a dependency cycle.
resource "azurerm_role_assignment" "func_reads_secrets" {
  for_each = var.environments

  scope                = module.auth[each.key].key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = module.app[each.key].principal_id
}

# One GitHub OIDC identity per environment, each scoped to its own resource group.
module "oidc" {
  source   = "./modules/github_oidc"
  for_each = var.environments

  project           = var.project
  env               = each.key
  github_owner      = var.github_owner
  github_repo       = var.github_repo
  resource_group_id = module.app[each.key].resource_group_id
  owner_object_ids  = [data.azuread_client_config.current.object_id]
}
