# App registration that GitHub Actions authenticates as (via OIDC — no client secret).
resource "azuread_application" "this" {
  display_name = "${var.project}-${var.env}-github-oidc"
  owners       = var.owner_object_ids
}

resource "azuread_service_principal" "this" {
  client_id = azuread_application.this.client_id
  owners    = var.owner_object_ids
}

# Trust GitHub's OIDC issuer for this repo's `${var.env}` Environment.
# The subject must exactly match the token GitHub Actions presents when a job
# runs with `environment: ${var.env}`.
resource "azuread_application_federated_identity_credential" "this" {
  application_id = azuread_application.this.id
  display_name   = "github-${var.github_repo}-${var.env}"
  description    = "GitHub Actions OIDC for ${var.github_owner}/${var.github_repo} (environment: ${var.env})"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_owner}/${var.github_repo}:environment:${var.env}"
}

# Scope deploy permissions to just this environment's resource group.
resource "azurerm_role_assignment" "contributor" {
  scope                = var.resource_group_id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.this.object_id
}
