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
  tags                   = merge(var.tags, { environment = each.key })
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
