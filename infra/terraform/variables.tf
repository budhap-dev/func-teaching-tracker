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
    # REQ-063: class files live in the teacher's own (personal) OneDrive, so
    # the SPA registration must also sign in personal Microsoft accounts and
    # may ask for its app folder. Off by default: dev proves it first, and
    # prod's sign-in stays exactly as it is until the feature ships.
    onedrive_files = optional(bool, false)
    # REQ-063: the SPA registration's display name, where it should read as
    # more than a technical id. OneDrive names the app's folder after it
    # (Apps/<name>) and Microsoft's consent screen shows it. Unset keeps
    # "<project>-<env>-spa".
    spa_display_name = optional(string)
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
      # REQ-063 spike: dev's SPA can reach the signed-in user's OneDrive.
      onedrive_files = true
    }
    prod = {
      # UK South for data residency: prod holds personal data about children,
      # so it lives in the UK to avoid a restricted international transfer
      # (GDPR plan §10.1). Moved while prod was still empty — no data migration.
      location               = "uksouth"
      node_version           = "24"
      maximum_instance_count = 100
      # REQ-035: the custom domain (and its www) join the paired SWA origin.
      # This list also feeds the Entra SPA redirect URIs (see main.tf), so
      # one apply covers both CORS and sign-in on the new domain.
      cors_allowed_origins = [
        "https://nice-sea-095463c0f.7.azurestaticapps.net",
        "https://abhitutor.co.uk",
        "https://www.abhitutor.co.uk",
      ]
      # Enforced: the UK stack is deployed and Microsoft sign-in is verified
      # end-to-end, so the API now rejects unauthenticated calls (Art. 32).
      auth_enforced = true
      # REQ-063 live (owner decision, 2026-11-12, incl. consumer terms and
      # residency — PRIVACY-ROPA §6 gap 5): files in the teacher's OneDrive,
      # under Apps/AbhiTutor.
      onedrive_files   = true
      spa_display_name = "AbhiTutor"
      data_store       = "tables"
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
