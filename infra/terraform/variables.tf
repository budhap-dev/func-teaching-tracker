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
  description = "Per-environment configuration (keyed by environment name: dev/test/prod)."
  type = map(object({
    location               = string
    node_version           = string
    instance_memory_in_mb  = optional(number, 2048)
    maximum_instance_count = optional(number, 40)
    cors_allowed_origins   = optional(list(string), [])
  }))
  default = {
    dev = {
      location             = "eastus"
      node_version         = "24"
      cors_allowed_origins = ["https://delightful-water-09b7c480f.7.azurestaticapps.net"]
    }
    test = {
      location             = "eastus"
      node_version         = "24"
      cors_allowed_origins = ["https://delightful-sea-0e15b030f.7.azurestaticapps.net"]
    }
    prod = {
      location               = "eastus"
      node_version           = "24"
      maximum_instance_count = 100
      cors_allowed_origins   = ["https://nice-sea-095463c0f.7.azurestaticapps.net"]
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
