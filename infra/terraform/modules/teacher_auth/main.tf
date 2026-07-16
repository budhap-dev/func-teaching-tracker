# Entra ID sign-in for the teacher (REQ-004, T1).
#
# Two single-tenant app registrations per environment — an API app exposing one
# scope, and a SPA app pre-authorised on it (no consent prompt) — plus a Key
# Vault holding the teacher-emails allow-list. The Function App's managed
# identity is granted read on the vault from the root module (passing the
# identity in here would make the two modules mutually dependent).
#
# The vault lives in its own small resource group rather than the app stack's:
# the app module consumes this module's outputs (app settings), so taking the
# app's RG here would close a module-level cycle Terraform rejects.

terraform {
  required_providers {
    azuread = { source = "hashicorp/azuread" }
    azurerm = { source = "hashicorp/azurerm" }
    random  = { source = "hashicorp/random" }
    time    = { source = "hashicorp/time" }
  }
}

locals {
  base = "${var.project}-${var.env}"
}

# ---------------------------------------------------------------------------
# API app registration: what the SPA requests a token FOR. The backend
# validates tokens against this app's client id (audience).
# ---------------------------------------------------------------------------

# The scope's stable UUID (Entra requires the caller to provide one).
resource "random_uuid" "teacher_scope" {}

resource "azuread_application" "api" {
  display_name     = "${local.base}-api"
  sign_in_audience = "AzureADMyOrg" # single-tenant: the first wall

  api {
    # v2.0 access tokens, so `iss` is login.microsoftonline.com/<tid>/v2.0 —
    # the issuer the Function's JWT validation expects. The default (v1)
    # issues sts.windows.net tokens, which would fail that check.
    requested_access_token_version = 2

    oauth2_permission_scope {
      id                         = random_uuid.teacher_scope.result
      value                      = "access_as_teacher"
      type                       = "User"
      enabled                    = true
      admin_consent_display_name = "Access Teaching Tracker as the teacher"
      admin_consent_description  = "Allows the app to call the Teaching Tracker API as the signed-in teacher."
      user_consent_display_name  = "Access Teaching Tracker as the teacher"
      user_consent_description   = "Allows the app to call the Teaching Tracker API on your behalf."
    }
  }

  # The URI lives in its own resource (it embeds this app's client id); without
  # this, each apply of the application strips it and the two resources fight.
  lifecycle {
    ignore_changes = [identifier_uris]
  }

  tags = ["terraform", var.env]
}

# api://<client-id> — set separately because an identifier URI that embeds the
# client id cannot be declared inline on the application itself.
resource "azuread_application_identifier_uri" "api" {
  application_id = azuread_application.api.id
  identifier_uri = "api://${azuread_application.api.client_id}"
}

resource "azuread_service_principal" "api" {
  client_id = azuread_application.api.client_id
}

# ---------------------------------------------------------------------------
# SPA app registration: what MSAL in the browser signs in AS.
# ---------------------------------------------------------------------------

resource "azuread_application" "spa" {
  display_name     = "${local.base}-spa"
  sign_in_audience = "AzureADMyOrg"

  single_page_application {
    # Entra requires a trailing slash on pathless URIs. MSAL must be configured
    # with the same exact form (`${origin}/`) — AADSTS50011 otherwise.
    redirect_uris = distinct([
      for u in var.spa_redirect_uris : endswith(u, "/") ? u : "${u}/"
    ])
  }

  required_resource_access {
    resource_app_id = azuread_application.api.client_id
    resource_access {
      id   = random_uuid.teacher_scope.result
      type = "Scope"
    }
  }

  tags = ["terraform", var.env]
}

resource "azuread_service_principal" "spa" {
  client_id = azuread_application.spa.client_id
}

# Pre-authorise the SPA on the API scope: sign-in never shows a consent prompt.
resource "azuread_application_pre_authorized" "spa_on_api" {
  application_id       = azuread_application.api.id
  authorized_client_id = azuread_application.spa.client_id
  permission_ids       = [random_uuid.teacher_scope.result]
}

# ---------------------------------------------------------------------------
# Key Vault: the teacher-emails allow-list. RBAC-only (no access policies).
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "this" {
  name     = "rg-${local.base}-auth"
  location = var.location
  tags     = var.tags
}

# Vault names are global and <= 24 chars: kv + project + env + 4 chars.
resource "random_string" "kv_suffix" {
  length  = 4
  lower   = true
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_key_vault" "this" {
  name                       = substr("kv${var.project}${var.env}${random_string.kv_suffix.result}", 0, 24)
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true

  # Emails, not crown jewels: keep teardown easy.
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  tags = var.tags
}

# The deploying principal writes the secret, and the vault is RBAC-only, so it
# needs a data-plane role — subscription Owner alone has none.
resource "azurerm_role_assignment" "deployer_admin" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = var.deployer_object_id
}

# RBAC grants propagate asynchronously; writing the secret immediately after
# the role assignment intermittently 403s. A short wait absorbs that.
resource "time_sleep" "rbac_propagation" {
  depends_on      = [azurerm_role_assignment.deployer_admin]
  create_duration = "30s"
}

resource "azurerm_key_vault_secret" "teacher_emails" {
  name         = "teacher-emails"
  value        = join(",", var.teacher_emails)
  key_vault_id = azurerm_key_vault.this.id
  content_type = "comma-separated emails"

  depends_on = [time_sleep.rbac_propagation]

  # The portal is the editing surface after bootstrap: adding a teacher must
  # not require terraform. Ignore drift on the value.
  lifecycle {
    ignore_changes = [value]
  }
}
