output "url" {
  description = "Open this once setup finishes (about 5-8 minutes after apply)."
  value       = var.domain != "" ? "https://${var.domain}/" : "http://${aws_eip.databench.public_ip}/"
}

output "ssh" {
  value = "ssh ubuntu@${aws_eip.databench.public_ip}"
}

output "watch_setup" {
  value = "ssh ubuntu@${aws_eip.databench.public_ip} 'tail -f /var/log/cloud-init-output.log'"
}

output "bucket" {
  description = "Where uploads and training results are kept."
  value       = aws_s3_bucket.databench.bucket
}
