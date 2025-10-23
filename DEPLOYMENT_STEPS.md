# Production Deployment Guide - MGNREGA App

## Prerequisites
- Ubuntu VPS (AWS EC2, DigitalOcean, Linode, etc.)
- Minimum: 2 vCPU, 4GB RAM
- Public IP address
- SSH access to VPS

---

## Step 1: Provision VPS

### Option A: AWS EC2 (Free Tier Available)
1. Go to AWS Console → EC2 → Launch Instance
2. Select Ubuntu 22.04 LTS
3. Instance type: t2.small (2GB RAM) or t2.medium (4GB RAM)
4. Configure Security Group:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
5. Create/select key pair for SSH
6. Launch instance
7. Note public IP address

### Option B: DigitalOcean Droplet
1. Go to DigitalOcean → Create Droplet
2. Select Ubuntu 22.04 LTS
3. Choose plan: Basic - $12/month (2GB RAM)
4. Add SSH key
5. Create droplet
6. Note public IP address

### Option C: Oracle Cloud (Free Forever)
1. Go to Oracle Cloud → Compute → Create Instance
2. Select Ubuntu 22.04
3. Shape: VM.Standard.E2.1.Micro (1GB RAM - FREE)
4. Add SSH key
5. Create instance
6. Note public IP

---

## Step 2: Initial Server Setup

### Connect to VPS
```bash
ssh ubuntu@YOUR_VPS_IP
# Or: ssh -i your-key.pem ubuntu@YOUR_VPS_IP
```

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20 (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 --version
```

### Install Nginx (Reverse Proxy)
```bash
sudo apt install nginx -y
sudo systemctl status nginx  # Should be active
```

### Install Git
```bash
sudo apt install git -y
```

---

## Step 3: Clone and Setup Application

### Create App Directory
```bash
cd /var/www
sudo mkdir mgnrega
sudo chown -R $USER:$USER mgnrega
cd mgnrega
```

### Clone Repository
```bash
# Replace with your actual repo URL
git clone https://github.com/YOUR_USERNAME/MGNREGA.git .
# Or upload files via SCP/SFTP
```

### Install Dependencies
```bash
npm ci --production
```

### Create Environment File
```bash
nano .env.production
```

Add:
```env
DATA_GOV_API_KEY=579b464db66ec23bdd000001da8a7abfbcd64f504fc56a39d974f160
NODE_ENV=production
PORT=3001
```

Save: Ctrl+X, Y, Enter

### Build Application
```bash
npm run build
```

This creates optimized production build in `.next/` directory.

---

## Step 4: Start Application with PM2

### Start App
```bash
pm2 start npm --name "mgnrega" -- start
```

### Verify Running
```bash
pm2 status
pm2 logs mgnrega  # Check logs
```

### Save PM2 Configuration
```bash
pm2 save
```

### Setup PM2 Auto-Start on Reboot
```bash
pm2 startup
# Copy and run the command it outputs (starts with sudo)
```

### Test Locally
```bash
curl http://localhost:3001
# Should return HTML
```

---

## Step 5: Configure Nginx Reverse Proxy

### Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/mgnrega
```

Add:
```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;  # Replace with your IP or domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static files
    location /_next/static/ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

Save: Ctrl+X, Y, Enter

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/mgnrega /etc/nginx/sites-enabled/
```

### Test Nginx Configuration
```bash
sudo nginx -t
# Should say "syntax is ok" and "test is successful"
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

---

## Step 6: Verify Deployment

### Test Public Access
Open browser and visit:
```
http://YOUR_VPS_IP
```

You should see the MGNREGA app!

### Check Logs
```bash
# Application logs
pm2 logs mgnrega

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Step 7: Setup HTTPS (Optional but Recommended)

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Get SSL Certificate
```bash
# If you have a domain:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts, enter email, agree to terms
```

### Auto-Renewal Test
```bash
sudo certbot renew --dry-run
```

Certbot auto-renews via cron/systemd timer.

---

## Step 8: Create Cache Directory (Important!)

```bash
cd /var/www/mgnrega
mkdir -p data/cache
chmod 755 data/cache
```

---

## Step 9: Monitoring Setup (Optional)

### Setup PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Setup UptimeRobot (External)
1. Go to uptimerobot.com (free)
2. Add monitor: HTTP(S), URL: http://YOUR_VPS_IP
3. Check interval: 5 minutes
4. Get alerts via email

---

## Production Maintenance Commands

### Restart App
```bash
pm2 restart mgnrega
```

### Update App (Deploy New Changes)
```bash
cd /var/www/mgnrega
git pull origin main  # Or your branch
npm ci --production
npm run build
pm2 restart mgnrega
```

### View Logs
```bash
pm2 logs mgnrega
pm2 logs mgnrega --lines 100  # Last 100 lines
```

### Monitor Resources
```bash
pm2 monit  # Live monitoring
htop       # System resources
```

### Stop App
```bash
pm2 stop mgnrega
```

### Delete from PM2
```bash
pm2 delete mgnrega
```

---

## Troubleshooting

### App Not Starting
```bash
# Check logs
pm2 logs mgnrega --err

# Try manual start to see errors
cd /var/www/mgnrega
npm start
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check app logs
pm2 logs mgnrega

# Restart both
pm2 restart mgnrega
sudo systemctl restart nginx
```

### Port Already in Use
```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill process
sudo kill -9 PID
```

### Cache Issues
```bash
# Clear app cache
rm -rf /var/www/mgnrega/data/cache/*

# Restart app
pm2 restart mgnrega
```

### Out of Memory
```bash
# Check memory
free -h

# If low, add swap:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Performance Optimization

### Enable PM2 Cluster Mode (Multi-core)
```bash
pm2 delete mgnrega
pm2 start npm --name "mgnrega" -i max -- start
pm2 save
```

### Enable Nginx Caching
Edit `/etc/nginx/sites-available/mgnrega`, add before `server` block:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=mgnrega_cache:10m max_size=100m inactive=60m;
```

Inside `location /` block, add:
```nginx
proxy_cache mgnrega_cache;
proxy_cache_valid 200 10m;
proxy_cache_bypass $http_cache_control;
add_header X-Cache-Status $upstream_cache_status;
```

Create cache directory:
```bash
sudo mkdir -p /var/cache/nginx
sudo chown www-data:www-data /var/cache/nginx
sudo nginx -t && sudo systemctl restart nginx
```

---

## Security Hardening

### Setup Firewall (UFW)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### Setup Fail2Ban (Prevent Brute Force)
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Disable Root SSH Login
```bash
sudo nano /etc/ssh/sshd_config
# Change: PermitRootLogin no
sudo systemctl restart sshd
```

---

## Final Checklist

- [ ] VPS provisioned with public IP
- [ ] Node.js 20+ installed
- [ ] App cloned and built successfully
- [ ] PM2 running app on port 3001
- [ ] Nginx reverse proxy configured
- [ ] Public URL accessible: http://YOUR_VPS_IP
- [ ] Cache directory created and writable
- [ ] PM2 auto-start configured
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] (Optional) HTTPS configured with Certbot
- [ ] (Optional) Monitoring setup (UptimeRobot)

---

## Your Production URL

After completing these steps, your app will be live at:

```
http://YOUR_VPS_IP
```

Or if you configured a domain:
```
https://yourdomain.com
```

**Share this URL as your final deliverable!**

---

## Estimated Time
- First-time setup: 45-60 minutes
- With experience: 15-20 minutes

## Estimated Cost
- **Free**: Oracle Cloud Free Tier (1GB RAM)
- **$5/month**: DigitalOcean Basic Droplet (1GB RAM)
- **$12/month**: DigitalOcean (2GB RAM - Recommended)
- **$15/month**: AWS EC2 t2.small (2GB RAM)

---

**Need Help?**
- Check PM2 docs: https://pm2.keymetrics.io/
- Check Nginx docs: https://nginx.org/en/docs/
- Check Node.js docs: https://nodejs.org/docs/
