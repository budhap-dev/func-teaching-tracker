variable "project" {
  description = "Short project name prefix (lowercase alphanumeric)."
  type        = string
}

variable "env" {
  description = "Environment name (e.g. dev, test, prod)."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "node_version" {
  description = "Node.js runtime version for the Flex Consumption Function App."
  type        = string
}

variable "instance_memory_in_mb" {
  description = "Per-instance memory for the Flex Consumption app."
  type        = number
  default     = 2048
}

variable "maximum_instance_count" {
  description = "Maximum number of instances the app can scale to."
  type        = number
  default     = 40
}

variable "cors_allowed_origins" {
  description = "Origins allowed to call this Function App from the browser (e.g. the paired Static Web App URL). Empty list leaves CORS unconfigured."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
