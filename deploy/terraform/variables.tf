variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Named profile from ~/.aws/credentials (set by `aws configure --profile ...`)."
  type        = string
  default     = "default"
}

variable "instance_type" {
  description = "t3.medium (4 GB) is the smallest that trains comfortably on larger files."
  type        = string
  default     = "t3.medium"
}

variable "public_key_path" {
  description = "Your SSH public key; its private half is what you ssh in with."
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ssh_cidr" {
  description = "Who may SSH in. Empty = only the public IP of the machine running terraform."
  type        = string
  default     = ""
}

variable "http_cidr" {
  description = "Who may open the site. 0.0.0.0/0 = anyone (it is still behind the site password)."
  type        = string
  default     = "0.0.0.0/0"
}

variable "repo_url" {
  description = "Public git repo the instance clones on first boot."
  type        = string
  default     = "https://github.com/JustSid26/data-bench.git"
}

variable "repo_ref" {
  description = "Branch or tag to deploy."
  type        = string
  default     = "main"
}

variable "site_user" {
  description = "Username for the site's password prompt."
  type        = string
  default     = "demo"
}

variable "site_password" {
  description = "Password for the site. Set it in terraform.tfvars (git-ignored), never in code."
  type        = string
  sensitive   = true

  validation {
    # it is written into a single-quoted shell string in user_data
    condition     = length(var.site_password) >= 8 && !strcontains(var.site_password, "'")
    error_message = "site_password must be at least 8 characters and contain no single quote."
  }
}
