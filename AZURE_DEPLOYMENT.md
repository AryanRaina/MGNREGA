# Azure Deployment Guide - MGNREGA App

## Overview
This guide covers deploying the MGNREGA app to Azure using Azure App Service (Web App), which gives you a managed VM with full control over Node.js environment.

**Estimated Time:** 20-30 minutes  
**Cost:** Free tier available (F1) or ~$13/month (B1 Basic)

---

## Prerequisites
- Azure account (you have this ✅)
- Git installed locally
- Azure CLI installed (optional but recommended)

---

## Option 1: Deploy via Azure Portal (No CLI needed) - EASIEST

### Step 1: Prepare Your Code

1. **Create `.deployment` file** in project root:

```bash
[config]
command = deploy.sh
```

2. **Create `deploy.sh` file** in project root:

```bash
#!/bin/bash

# Install dependencies
npm install

# Build the app
npm run build

# Exit if build failed
if [ $? -ne 0 ]; then
  echo "Build failed"
  exit 1
fi

echo "Build completed successfully"
```

3. **Update `package.json`** - Make sure you have:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p $PORT",
    "lint": "next lint"
  }
}
```

Note: Azure sets the PORT environment variable automatically.

4. **Create `.gitignore`** (if not already present):

```
node_modules/
.next/
.env.local
.env.production
.env
out/
build/
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.vercel
```

### Step 2: Create Azure Web App

1. **Login to Azure Portal**: https://portal.azure.com

2. **Create Web App**:
   - Click "Create a resource"
   - Search for "Web App"
   - Click "Create"

3. **Configure Web App**:

   **Basics Tab:**
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new → Name it "mgnrega-rg"
   - **Name**: Choose unique name (e.g., "mgnrega-india-app")
     - This will be your URL: `https://mgnrega-india-app.azurewebsites.net`
   - **Publish**: Code
   - **Runtime stack**: Node 20 LTS
   - **Operating System**: Linux
   - **Region**: Choose closest to India (e.g., "Central India" or "South India")
   
   **Pricing:**
   - **Pricing Plan**: 
     - **Free (F1)** - Free, limited resources, good for demo
     - **Basic B1** - ~$13/month, better performance, recommended
   
   Click "Review + Create" → "Create"

4. **Wait for Deployment** (2-3 minutes)

### Step 3: Configure Application Settings

1. **Go to your Web App** in Azure Portal

2. **Configuration** (left sidebar):
   - Click "Application settings"
   - Click "+ New application setting"
   
   Add these:
   
   **Name:** `DATA_GOV_API_KEY`  
   **Value:** `579b464db66ec23bdd000001da8a7abfbcd64f504fc56a39d974f160`
   
   **Name:** `NODE_ENV`  
   **Value:** `production`
   
   **Name:** `WEBSITE_NODE_DEFAULT_VERSION`  
   **Value:** `20-lts`
   
   Click "Save"

### Step 4: Deploy Your Code

**Method A: Deploy from Local Git (Recommended)**

1. **In Azure Portal** → Your Web App → **Deployment Center** (left sidebar)

2. **Source**: Select "Local Git"

3. **Click "Save"**

4. **Copy the Git Clone URL** (looks like: `https://mgnrega-india-app.scm.azurewebsites.net/mgnrega-india-app.git`)

5. **Set Deployment Credentials**:
   - Go to **Deployment Center** → **FTPS credentials** tab
   - Set a username and password
   - Click "Save"

6. **On Your Local Machine** (in PowerShell):

```powershell
# Navigate to your project
cd C:\Users\aryan\Desktop\Coding\MGNREGA

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for Azure deployment"

# Add Azure remote (replace with your Git Clone URL)
git remote add azure https://YOUR-USERNAME@mgnrega-india-app.scm.azurewebsites.net/mgnrega-india-app.git

# Push to Azure (will ask for the password you set)
git push azure main
# Or if your branch is master:
git push azure master
```

7. **Wait for Build** (5-10 minutes):
   - Azure will automatically install dependencies
   - Run `npm run build`
   - Start the app

**Method B: Deploy from GitHub (Alternative)**

1. **Push your code to GitHub** first

2. **In Azure Portal** → Your Web App → **Deployment Center**

3. **Source**: Select "GitHub"

4. **Authorize Azure** to access your GitHub

5. **Select** your repository and branch

6. **Save** - Azure will auto-deploy from GitHub

**Method C: Deploy via ZIP (Quickest for Testing)**

1. **On Your Local Machine**:

```powershell
# Build locally first
npm run build

# Create a ZIP of necessary files
Compress-Archive -Path * -DestinationPath deploy.zip -Force
```

2. **In Azure Portal** → Your Web App → **Advanced Tools (Kudu)**

3. Click "Go" → Opens Kudu console

4. **Tools** → **Zip Push Deploy**

5. **Drag and drop** your `deploy.zip` file

### Step 5: Configure Startup Command

1. **In Azure Portal** → Your Web App → **Configuration** → **General settings**

2. **Startup Command**: 
```bash
npm start
```

3. **Click "Save"**

### Step 6: Verify Deployment

1. **Browse to your app**:
   - Click "Browse" in Azure Portal
   - Or visit: `https://YOUR-APP-NAME.azurewebsites.net`

2. **Check logs** if issues:
   - **Log stream**: Azure Portal → Your Web App → **Log stream**
   - **Advanced Tools (Kudu)**: Go → Debug console → CMD → Navigate to `LogFiles`

---

## Option 2: Deploy via Azure CLI (Advanced)

### Step 1: Install Azure CLI

Download from: https://aka.ms/installazurecliwindows

Or use PowerShell:
```powershell
winget install Microsoft.AzureCLI
```

### Step 2: Login to Azure

```powershell
az login
```

### Step 3: Create Resources

```powershell
# Set variables
$resourceGroup = "mgnrega-rg"
$location = "centralindia"
$appName = "mgnrega-india-app"  # Must be globally unique
$planName = "mgnrega-plan"

# Create resource group
az group create --name $resourceGroup --location $location

# Create App Service plan (B1 Basic tier)
az appservice plan create --name $planName --resource-group $resourceGroup --sku B1 --is-linux

# Create web app
az webapp create --resource-group $resourceGroup --plan $planName --name $appName --runtime "NODE:20-lts"

# Configure environment variables
az webapp config appsettings set --resource-group $resourceGroup --name $appName --settings DATA_GOV_API_KEY="579b464db66ec23bdd000001da8a7abfbcd64f504fc56a39d974f160" NODE_ENV="production"

# Configure startup command
az webapp config set --resource-group $resourceGroup --name $appName --startup-file "npm start"
```

### Step 4: Deploy Code

```powershell
# Navigate to project
cd C:\Users\aryan\Desktop\Coding\MGNREGA

# Build locally
npm run build

# Create ZIP for deployment
Compress-Archive -Path * -DestinationPath deploy.zip -Force

# Deploy ZIP
az webapp deploy --resource-group $resourceGroup --name $appName --src-path deploy.zip --type zip

# Or deploy via Git
az webapp deployment source config-local-git --name $appName --resource-group $resourceGroup

# Get Git URL
az webapp deployment list-publishing-credentials --name $appName --resource-group $resourceGroup --query scmUri --output tsv
```

---

## Option 3: Deploy to Azure VM (Full VPS Control)

If you want complete control like a traditional VPS:

### Step 1: Create Ubuntu VM

```powershell
# Create VM
az vm create `
  --resource-group mgnrega-rg `
  --name mgnrega-vm `
  --image Ubuntu2204 `
  --size Standard_B2s `
  --admin-username azureuser `
  --generate-ssh-keys

# Open ports
az vm open-port --resource-group mgnrega-rg --name mgnrega-vm --port 80
az vm open-port --resource-group mgnrega-rg --name mgnrega-vm --port 443
az vm open-port --resource-group mgnrega-rg --name mgnrega-vm --port 3001
```

### Step 2: SSH and Setup

Get VM IP:
```powershell
az vm show --resource-group mgnrega-rg --name mgnrega-vm --show-details --query publicIps --output tsv
```

SSH to VM (use WSL or PowerShell SSH):
```bash
ssh azureuser@YOUR_VM_IP
```

Then follow the regular VPS deployment steps from `DEPLOYMENT_STEPS.md` (install Node.js, PM2, Nginx, etc.)

---

## Post-Deployment Configuration

### Enable Logging

```powershell
# Enable application logging
az webapp log config --resource-group mgnrega-rg --name mgnrega-india-app --application-logging filesystem --level information

# Stream logs
az webapp log tail --resource-group mgnrega-rg --name mgnrega-india-app
```

### Setup Custom Domain (Optional)

1. **In Azure Portal** → Your Web App → **Custom domains**
2. Click "+ Add custom domain"
3. Enter your domain
4. Follow DNS configuration instructions

### Enable HTTPS (Automatic)

Azure provides free SSL certificate automatically for `*.azurewebsites.net` domains.

For custom domain:
1. **Custom domains** → Select domain → **Add binding**
2. Choose "SNI SSL" (free)

### Setup Auto-Scaling (Optional)

1. **App Service plan** → **Scale out (App Service plan)**
2. Configure rules based on CPU/memory usage

---

## Monitoring & Maintenance

### View Logs

**Azure Portal Method:**
1. Your Web App → **Log stream**

**CLI Method:**
```powershell
az webapp log tail --resource-group mgnrega-rg --name mgnrega-india-app
```

### Restart App

**Portal:** Click "Restart" button

**CLI:**
```powershell
az webapp restart --resource-group mgnrega-rg --name mgnrega-india-app
```

### Update App (Redeploy)

```powershell
# Make your code changes
git add .
git commit -m "Update"

# If using Local Git:
git push azure main

# If using ZIP:
npm run build
Compress-Archive -Path * -DestinationPath deploy.zip -Force
az webapp deploy --resource-group mgnrega-rg --name mgnrega-india-app --src-path deploy.zip --type zip
```

---

## Troubleshooting

### App not starting

**Check logs:**
```powershell
az webapp log tail --resource-group mgnrega-rg --name mgnrega-india-app
```

**Common issues:**
1. Missing `npm start` in startup command
2. Wrong Node version - Set to 20 LTS
3. Build failed - Check build logs
4. Port issue - Azure sets PORT env var automatically

### Check if build succeeded

Go to Kudu console:
- Azure Portal → Your Web App → **Advanced Tools** → **Go**
- Check if `.next` folder exists

### Clear cache and rebuild

```powershell
# SSH into Kudu
# Azure Portal → Advanced Tools → Go → Debug console

# Run:
rm -rf node_modules .next
npm install
npm run build
```

---

## Performance Optimization

### Enable Application Insights (Monitoring)

```powershell
az monitor app-insights component create --app mgnrega-insights --location centralindia --resource-group mgnrega-rg --application-type web

# Link to web app
az webapp config appsettings set --resource-group mgnrega-rg --name mgnrega-india-app --settings APPINSIGHTS_INSTRUMENTATIONKEY="YOUR_KEY"
```

### Enable Always On (Prevents cold starts)

**Portal:** Configuration → General settings → Always On → On

**CLI:**
```powershell
az webapp config set --resource-group mgnrega-rg --name mgnrega-india-app --always-on true
```

### Setup CDN (Optional)

1. Create Azure CDN profile
2. Add endpoint pointing to your web app
3. Configure caching rules

---

## Cost Optimization

### Free Tier (F1)
- **Cost**: Free
- **Limitations**: 60 minutes/day compute, 1GB RAM, 1GB storage
- **Good for**: Demo, testing

### Basic B1 (Recommended)
- **Cost**: ~$13/month
- **Resources**: 1.75GB RAM, 10GB storage
- **Good for**: Production with moderate traffic

### To use Free tier:

```powershell
# Create free plan
az appservice plan create --name mgnrega-free-plan --resource-group mgnrega-rg --sku F1 --is-linux

# Update web app to use free plan
az webapp update --resource-group mgnrega-rg --name mgnrega-india-app --set serverFarmId="/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/mgnrega-rg/providers/Microsoft.Web/serverfarms/mgnrega-free-plan"
```

---

## Final Checklist

- [ ] Web App created on Azure
- [ ] Node.js 20 LTS configured
- [ ] Environment variables set (DATA_GOV_API_KEY, NODE_ENV)
- [ ] Code deployed successfully
- [ ] App builds without errors (.next folder created)
- [ ] Startup command set to `npm start`
- [ ] App accessible at https://YOUR-APP-NAME.azurewebsites.net
- [ ] Logs show "ready on port" message
- [ ] Test IP detection works
- [ ] Test district selection works
- [ ] Test language toggle works
- [ ] Test mobile responsive design

---

## Your Production URL

After deployment, your app will be live at:

```
https://YOUR-APP-NAME.azurewebsites.net
```

Example: `https://mgnrega-india-app.azurewebsites.net`

**This URL is your deliverable!** ✅

---

## Quick Deploy Summary (TL;DR)

```powershell
# 1. Login to Azure Portal
# 2. Create Web App (Node 20 LTS, Linux, Central India)
# 3. Add environment variable: DATA_GOV_API_KEY
# 4. In your project:
git init
git add .
git commit -m "Deploy to Azure"
git remote add azure <YOUR_AZURE_GIT_URL>
git push azure main

# 5. Wait 5-10 minutes for build
# 6. Visit https://YOUR-APP-NAME.azurewebsites.net
```

---

## Advantages of Azure Deployment

✅ **Meets VPS requirement** (Azure is a cloud provider, not an AI platform)  
✅ **Automatic SSL/HTTPS**  
✅ **Auto-scaling capability**  
✅ **Built-in monitoring (Application Insights)**  
✅ **India-based data centers** (low latency)  
✅ **Free tier available**  
✅ **Easy to manage via Portal or CLI**  
✅ **Professional cloud platform** (Microsoft Azure)  

---

## Need Help?

- Azure Docs: https://docs.microsoft.com/azure/app-service/
- Node.js on Azure: https://docs.microsoft.com/azure/app-service/quickstart-nodejs
- Azure CLI Reference: https://docs.microsoft.com/cli/azure/

---

**Estimated Total Time: 20-30 minutes** 🚀

**Your Azure URL will be the perfect deliverable for your requirements!**
