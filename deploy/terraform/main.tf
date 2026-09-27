# the public IP of whoever runs `terraform apply`, for the SSH rule
data "http" "my_ip" {
  url = "https://checkip.amazonaws.com"
}

locals {
  ssh_cidr = var.ssh_cidr != "" ? var.ssh_cidr : "${chomp(data.http.my_ip.response_body)}/32"
}

# latest Ubuntu 24.04 from Canonical
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "databench" {
  key_name   = "databench"
  public_key = file(pathexpand(var.public_key_path))
}

resource "aws_security_group" "databench" {
  name        = "databench"
  description = "DataBench: http for the site, ssh for you"

  ingress {
    description = "http"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.http_cidr]
  }

  ingress {
    description = "ssh"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [local.ssh_cidr]
  }

  egress {
    description = "apt, pip, npm, git"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "databench" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.databench.key_name
  vpc_security_group_ids = [aws_security_group.databench.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  # first boot: clone, then run the same setup script as a manual deploy.
  # progress: ssh in and `tail -f /var/log/cloud-init-output.log`
  iam_instance_profile = aws_iam_instance_profile.databench.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    bucket        = aws_s3_bucket.databench.bucket
    region        = var.region
    repo_url      = var.repo_url
    repo_ref      = var.repo_ref
    site_user     = var.site_user
    site_password = var.site_password
  })
  # the script only runs on first boot; later changes are rolled out with
  # setup.sh over ssh, so an edit here must never replace a running server
  user_data_replace_on_change = false

  lifecycle {
    ignore_changes = [user_data]
  }

  tags = {
    Name = "databench"
  }
}

# a fixed address, so the url survives a stop / start before the demo
resource "aws_eip" "databench" {
  instance = aws_instance.databench.id
  domain   = "vpc"
}
