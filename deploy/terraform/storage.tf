data "aws_caller_identity" "current" {}

# uploaded datasets and training results, so a restart or redeploy loses nothing
resource "aws_s3_bucket" "databench" {
  bucket = "databench-${data.aws_caller_identity.current.account_id}-${var.region}"

  # demo project: `terraform destroy` empties and removes the bucket too
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "databench" {
  bucket                  = aws_s3_bucket.databench.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "databench" {
  bucket = aws_s3_bucket.databench.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "databench" {
  bucket = aws_s3_bucket.databench.id
  rule {
    id     = "abort-stalled-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# the instance's identity: it may read and write this one bucket and nothing
# else, and no access keys ever sit on the server
resource "aws_iam_role" "databench" {
  name = "databench-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "databench_s3" {
  name = "databench-bucket"
  role = aws_iam_role.databench.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListTheBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.databench.arn
      },
      {
        Sid      = "ReadWriteObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.databench.arn}/*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "databench" {
  name = "databench-ec2"
  role = aws_iam_role.databench.name
}
