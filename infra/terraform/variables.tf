variable "project" {
  description = "Short project name used as a prefix for Azure resources (lowercase alphanumeric)."
  type        = string
  default     = "teachtracker"

  validation {
    condition     = can(regex("^[a-z0-9]{1,12}$", var.project))
    error_message = "project must be 1-12 lowercase alphanumeric characters (keeps storage account names within 24 chars)."
  }
}

variable "github_owner" {
  description = "GitHub org/user that owns the repository (used for the OIDC federated subject)."
  type        = string
  default     = "budhap-dev"
}

variable "github_repo" {
  description = "GitHub repository name (used for the OIDC federated subject)."
  type        = string
  default     = "func-teaching-tracker"
}

# One Function App + one OIDC identity is provisioned per entry in this map.
# The keys must match the GitHub Environment names used in the deploy workflow.
variable "environments" {
  description = "Per-environment configuration (keyed by environment name: dev/prod)."
  type = map(object({
    location               = string
    node_version           = string
    instance_memory_in_mb  = optional(number, 2048)
    maximum_instance_count = optional(number, 40)
    cors_allowed_origins   = optional(list(string), [])
    # REQ-004 T4: whether the API rejects unauthenticated calls. Managed here
    # so a later apply never silently un-enforces it (was an out-of-band flip).
    auth_enforced = optional(bool, false)
    # REQ-009: which persistence adapter the app uses. "memory" until the
    # env's tables are provisioned and seeded, then "tables".
    data_store = optional(string, "memory")
  }))
  default = {
    dev = {
      # REQ-009 phase 0: the data-processing stack lives in the UK.
      location             = "uksouth"
      node_version         = "24"
      cors_allowed_origins = ["https://kind-sea-093f96a0f.7.azurestaticapps.net"]
      # Dev enforces sign-in (flipped 2026-07-17); phase 5 flipped to tables.
      auth_enforced = true
      data_store    = "tables"
    }
    prod = {
      # UK South for data residency: prod holds personal data about children,
      # so it lives in the UK to avoid a restricted international transfer
      # (GDPR plan §10.1). Moved while prod was still empty — no data migration.
      location               = "uksouth"
      node_version           = "24"
      maximum_instance_count = 100
      cors_allowed_origins   = ["https://nice-sea-095463c0f.7.azurestaticapps.net"]
      # Stays false until the new UK stack is deployed and sign-in is verified
      # end-to-end; flipping it before that would lock the teacher out.
      auth_enforced          = false
      data_store             = "tables"
    }
  }
}

variable "tags" {
  description = "Base tags applied to all resources (environment tag is added per env)."
  type        = map(string)
  default = {
    project   = "func-teaching-tracker"
    managedBy = "terraform"
  }
}

variable "teacher_emails" {
  description = "Emails allowed to act as the teacher (REQ-004). Seeds the per-env Key Vault secret 'teacher-emails'; edit the secret in the portal afterwards — changes here are ignored once the secret exists."
  type        = list(string)
}
