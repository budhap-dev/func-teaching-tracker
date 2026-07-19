terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
    random  = { source = "hashicorp/random" }
  }
}

# A dedicated storage account for durable app data (REQ-009), kept apart from
# the Function App's deploy-plumbing storage: this one outlives redeploys and
# re-provisions, which is the whole point.
#
# Access posture: the app and the seeder authenticate with an Entra identity
# holding a data-plane RBAC role (the managed identity at runtime, the deployer
# for seeding) — they never touch the account key. Shared-key access stays
# *enabled* only because the azurerm provider reads the account's service
# properties over the data plane with key auth on every plan; disabling it (the
# stricter GDPR §10.4 ideal) needs a provider-wide storage_use_azuread switch
# and data-plane roles on every storage account, deferred as a hardening step.
# The account key is reachable only by an owner or the Terraform deployer — the
# CI identities have no rights in this resource group. prevent_destroy guards
# the real student records against an accidental `terraform destroy`.
#
# The four tables (students, sessions, settlements, counters) are NOT created
# here: the one-off seeder creates them over AAD with the deployer's identity
# (`npm run seed`). Prod, which is not seeded, gets its empty tables + zero
# counters from the same tool run with --empty. Keeping tables out of Terraform
# keeps the data plane out of the provider's plan/apply path.
resource "random_string" "suffix" {
  length  = 6
  lower   = true
  upper   = false
  numeric = true
  special = false
}

# Its own resource group — like teacher_auth's — so the data account does not
# depend on the app's RG. That keeps the module graph acyclic: the app reads
# this account's table endpoint, and nothing here reads back into the app.
resource "azurerm_resource_group" "this" {
  name     = "rg-${var.project}-${var.env}-data"
  location = var.location
  tags     = var.tags
}

resource "azurerm_storage_account" "this" {
  name                     = substr(lower("stdata${var.env}${random_string.suffix.result}"), 0, 24)
  resource_group_name      = azurerm_resource_group.this.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # Kept enabled for the provider's sake (see the header comment); the app
  # authenticates with its managed identity regardless.
  shared_access_key_enabled       = true
  public_network_access_enabled   = true
  allow_nested_items_to_be_public = false

  tags = var.tags

  lifecycle {
    prevent_destroy = true
  }
}
