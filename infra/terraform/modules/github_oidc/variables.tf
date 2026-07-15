variable "project" {
  description = "Short project name prefix."
  type        = string
}

variable "env" {
  description = "Environment name (must match the GitHub Environment name)."
  type        = string
}

variable "github_owner" {
  description = "GitHub org/user that owns the repository."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
}

variable "resource_group_id" {
  description = "Resource group the CI identity gets Contributor on."
  type        = string
}

variable "owner_object_ids" {
  description = "AAD object IDs set as owners of the app registration / service principal."
  type        = list(string)
  default     = []
}
