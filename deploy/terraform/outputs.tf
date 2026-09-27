output "url" {
  description = "Open this once setup finishes (about 5-8 minutes after apply)."
  value       = "http://${aws_eip.databench.public_ip}/"
}

output "ssh" {
  value = "ssh ubuntu@${aws_eip.databench.public_ip}"
}

output "watch_setup" {
  value = "ssh ubuntu@${aws_eip.databench.public_ip} 'tail -f /var/log/cloud-init-output.log'"
}
