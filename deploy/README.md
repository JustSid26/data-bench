# Deploying DataBench to EC2

One instance runs everything: uvicorn serves the api at `/api` and the built UI
at `/`, with nginx in front for uploads, timeouts and a site password. About 20
minutes end to end, most of it waiting on `pip`.

## Option A: Terraform (recommended)

`deploy/terraform/` creates the instance, security group, key pair, Elastic
IP, an S3 bucket for datasets and training results, and an IAM role that lets
the instance use that bucket (no keys on the server). On first boot the
instance clones this repo and runs `setup.sh`.

The deploying IAM user needs `AmazonEC2FullAccess` plus the scoped inline
policy in `deploy/terraform/deployer-policy.json`.

```bash
aws configure --profile databench          # an IAM user with AmazonEC2FullAccess
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars   # set site_password + aws_profile
terraform init
terraform apply                            # 4 resources; prints url + ssh
```

The site answers about 5–8 minutes after `apply` (watch with the printed
`watch_setup` command). SSH is only open to the IP that ran terraform. To
redeploy new commits: push, then `ssh` in and run
`cd ~/data-bench && git pull && sudo bash deploy/setup.sh`.
When the presentation is over: `terraform destroy`.

**SSH times out?** SSH is only open to the IP that last ran terraform. After
changing networks, run `terraform apply` again -- it only updates that one
firewall rule (the site itself stays open on port 80 throughout).

## Option B: by hand

### 1. Launch the instance (AWS console)

EC2 → **Launch instance**:

| setting | value |
| --- | --- |
| Name | `databench` |
| AMI | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **t3.medium** (2 vCPU, 4 GB). t3.small runs out of memory training on bigger files. |
| Key pair | create one, download the `.pem` |
| Network | allow **SSH from My IP**, allow **HTTP from Anywhere** (or only the venue's IP if you know it) |
| Storage | 20 GB gp3 |

Then **Elastic IPs → Allocate → Associate** it with the instance, so the
address survives a stop/start before the presentation.

### 2. Get the code onto it

```bash
chmod 400 databench.pem
ssh -i databench.pem ubuntu@<ELASTIC_IP>
```

The repo is on GitHub (`JustSid26/data-bench`). Push your local commits first,
then on the instance:

```bash
git clone https://github.com/JustSid26/data-bench.git
```

If the repo is private, either clone with a personal access token, or skip git
and copy from your laptop instead:

```bash
# on your laptop, from the repo root
rsync -az --exclude node_modules --exclude .venv --exclude frontend/dist --exclude .git \
  -e "ssh -i databench.pem" ./ ubuntu@<ELASTIC_IP>:~/data-bench/
```

### 3. Install and start

```bash
cd ~/data-bench
sudo bash deploy/setup.sh
```

It installs Python, Node 20 and nginx, installs the backend requirements,
builds the UI, asks for a **username and password** for the site, and starts
two services: `databench` (uvicorn) and `nginx`.

Open `http://<ELASTIC_IP>/` and log in.

## Updating before the demo

```bash
cd ~/data-bench && git pull          # or rsync again from the laptop
sudo bash deploy/setup.sh            # rebuilds and restarts; keeps the password
```

## Operating it

```bash
sudo systemctl status databench      # is it up
sudo journalctl -u databench -f      # live api logs
sudo systemctl restart databench     # clears every loaded dataset
```

## Things to know for the presentation

- **Load files with the drop zone, not "load from a path".** The path endpoint
  reads files from the server's own disk, so nginx blocks it (403) on the
  public box.
- **Datasets are kept in S3** (Terraform setup). Memory holds at most 12 for
  4 hours for speed; anything restarted or evicted reloads from the bucket on
  first use, and finished training results survive restarts too. The manual
  setup has no bucket, so there a restart clears everything.
- **One worker on purpose.** Don't raise `--workers`: uploads and training
  jobs would land in different processes and seem to vanish.
- **Plain HTTP.** Fine for a demo behind a password. For HTTPS you need a
  domain pointed at the Elastic IP, then
  `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`.
- **Cost.** t3.medium is about $0.04/hour. **Stop the instance after the
  presentation** (and release the Elastic IP if you terminate it).
