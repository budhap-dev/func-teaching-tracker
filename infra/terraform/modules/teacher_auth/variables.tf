variable "project" {
  description = "Short project name prefix (lowercase alphanumeric)."
  type        = string
}

variable "env" {
  description = "Environment name (e.g. dev, prod)."
  type        = string
}

variable "location" {
  description = "Azure region for the Key Vault."
  type        = string
}

variable "tenant_id" {
  description = "Entra tenant ID."
  type        = string
}

variable "deployer_object_id" {
  description = "Object ID of the principal running Terraform — granted Key Vault Administrator so the teacher-emails secret can be written (the vault is RBAC-only)."
  type        = string
}

variable "spa_redirect_uris" {
  description = "Redirect URIs for the SPA app registration (the environment's frontend origin; localhost too on dev)."
  type        = list(string)
}

variable "spa_display_name" {
  description = "REQ-063: the SPA registration's display name — OneDrive's app folder and the consent screen show it. Null keeps \"<base>-spa\"."
  type        = string
  default     = null
}

variable "onedrive_files" {
  description = "REQ-063: let the SPA sign in personal Microsoft accounts too and request Files.ReadWrite.AppFolder, so the browser can keep class files in the teacher's own OneDrive. The API registration is unaffected."
  type        = bool
  default     = false
}

variable "teacher_emails" {
  description = "Emails allowed to act as the teacher. Stored comma-separated in the teacher-emails secret; edit the secret later without a deploy."
  type        = list(string)

  validation {
    condition     = length(var.teacher_emails) > 0
    error_message = "At least one teacher email is required."
  }
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
