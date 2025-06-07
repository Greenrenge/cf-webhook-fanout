# Cloudflare Deployment Guidelines

This document provides step-by-step instructions for deploying both the Webhook Dashboard (Next.js) and Webhook Worker (Hono) to Cloudflare infrastructure.

## Prerequisites

### System Requirements
- **Node.js**: v20.0.0 or higher (required by Wrangler)
- **npm**: Latest version recommended
- **Cloudflare Account**: With Workers and Pages access

### Check Node.js Version
```bash
node --version
```

If you need to upgrade Node.js:
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
```

### Install Wrangler CLI
```bash
npm install -g wrangler
# or install locally in each project
npm install --save-dev wrangler
```

### Authenticate with Cloudflare
```bash
npx wrangler auth login
# Follow browser prompts to authorize
```

## Webhook Worker Deployment

### 1. Navigate to Worker Directory
```bash
cd webhook-fanout-worker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Set up production secrets using Wrangler:

```bash
# Set NextAuth secret for JWT validation
npx wrangler secret put NEXTAUTH_SECRET
# Enter the same secret used in dashboard

# Optional: Set Keycloak configuration for enhanced JWT validation
npx wrangler secret put KEYCLOAK_ISSUER
npx wrangler secret put KEYCLOAK_CLIENT_ID
```

### 4. Review Worker Configuration
Ensure `wrangler.toml` is properly configured:

```toml
name = "webhook-fanout-worker"
main = "src/index.ts"
compatibility_date = "2025-06-07"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "webhook-fanout-db"
database_id = "your-database-id"

# Environment variables
[env.production.vars]
WEBHOOK_PATH = "/webhook"

# For development
[env.development]
# Add development-specific configuration
```

### 5. Set Up D1 Database (First Time Only)
```bash
# Create D1 database (if not exists)
npx wrangler d1 create webhook-fanout-db

# Apply migrations
npx wrangler d1 migrations apply webhook-fanout-db --remote
```

### 6. Deploy Worker
```bash
# Deploy to production
npx wrangler deploy

# Deploy to staging (optional)
npx wrangler deploy --env staging
```

### 7. Verify Worker Deployment
```bash
# Test authentication endpoint (should return 401)
curl -X GET "https://webhook-fanout-worker.YOUR_SUBDOMAIN.workers.dev/logs"

# Test webhook endpoint (should work without auth)
curl -X POST "https://webhook-fanout-worker.YOUR_SUBDOMAIN.workers.dev/webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Webhook Dashboard Deployment

### 1. Navigate to Dashboard Directory
```bash
cd webhook-dashboard
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Set up production secrets for Cloudflare Pages:

```bash
# NextAuth configuration
npx wrangler pages secret put NEXTAUTH_SECRET
npx wrangler pages secret put NEXTAUTH_URL
# Enter: https://YOUR_DOMAIN.pages.dev

# Keycloak configuration
npx wrangler pages secret put KEYCLOAK_CLIENT_ID
npx wrangler pages secret put KEYCLOAK_CLIENT_SECRET
npx wrangler pages secret put KEYCLOAK_ISSUER

# Worker API URL
npx wrangler pages secret put NEXT_PUBLIC_WORKER_API_URL
# Enter: https://webhook-fanout-worker.YOUR_SUBDOMAIN.workers.dev
```

### 4. Review Dashboard Configuration
Ensure `wrangler.toml` is properly configured:

```toml
name = "webhook-dashboard"
compatibility_date = "2025-06-07"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[env.production.vars]
NODE_ENV = "production"
```

### 5. Build for Cloudflare Pages
```bash
# Build using Cloudflare adapter
npm run pages:build
```

### 6. Deploy to Cloudflare Pages
```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy .vercel/output/static --project-name webhook-dashboard

# First deployment will prompt to create project
# Enter production branch name: main
```

### 7. Verify Dashboard Deployment
```bash
# Test providers endpoint
curl "https://YOUR_DEPLOYMENT.webhook-dashboard.pages.dev/api/auth/providers"

# Should return Keycloak provider configuration
```

## Production Configuration

### Environment Variables Summary

**Worker (`webhook-fanout-worker`):**
- `NEXTAUTH_SECRET`: JWT validation secret
- `KEYCLOAK_ISSUER`: (Optional) Keycloak realm URL for enhanced validation
- `KEYCLOAK_CLIENT_ID`: (Optional) Client ID for audience validation

**Dashboard (`webhook-dashboard`):**
- `NEXTAUTH_SECRET`: NextAuth encryption secret
- `NEXTAUTH_URL`: Production dashboard URL
- `KEYCLOAK_CLIENT_ID`: Keycloak client identifier
- `KEYCLOAK_CLIENT_SECRET`: Keycloak client secret
- `KEYCLOAK_ISSUER`: Keycloak realm URL
- `NEXT_PUBLIC_WORKER_API_URL`: Worker API base URL

### Custom Domains (Optional)

To set up custom domains:

```bash
# For Pages (Dashboard)
npx wrangler pages domain add webhook-dashboard your-domain.com

# For Workers (API)
# Configure custom domain through Cloudflare Dashboard
# Workers > webhook-fanout-worker > Settings > Triggers > Custom Domains
```

## Deployment Scripts

Add these scripts to your `package.json` files for easier deployment:

**Worker (`webhook-fanout-worker/package.json`):**
```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "tail": "wrangler tail"
  }
}
```

**Dashboard (`webhook-dashboard/package.json`):**
```json
{
  "scripts": {
    "pages:build": "npx @cloudflare/next-on-pages",
    "preview": "npm run pages:build && wrangler pages dev",
    "deploy": "npm run pages:build && wrangler pages deploy",
    "pages:tail": "wrangler pages deployment tail"
  }
}
```

## Monitoring and Logs

### View Worker Logs
```bash
# Real-time logs
npx wrangler tail webhook-fanout-worker

# View deployment logs
npx wrangler pages deployment tail webhook-dashboard
```

### Check Deployment Status
```bash
# List worker deployments
npx wrangler deployments list

# List pages deployments
npx wrangler pages deployment list --project-name webhook-dashboard
```

## Troubleshooting

### Common Issues

**1. Node.js Version Error**
```
Error: Wrangler requires at least Node.js v20.0.0
```
**Solution:** Upgrade Node.js using nvm or download from nodejs.org

**2. Authentication Errors**
```
Error: Not authenticated
```
**Solution:** Run `npx wrangler auth login` and complete browser authentication

**3. D1 Database Not Found**
```
Error: The D1 database "webhook-fanout-db" does not exist
```
**Solution:** Create database with `npx wrangler d1 create webhook-fanout-db`

**4. Environment Variable Missing**
```
Error: Missing environment variable
```
**Solution:** Set missing variables with `npx wrangler secret put VARIABLE_NAME`

**5. Build Errors with NextAuth**
```
Error: Module not found or type errors
```
**Solution:** Ensure NextAuth v5 is installed and `trustHost: true` is set in auth config

### Debug Commands

```bash
# Check worker configuration
npx wrangler whoami
npx wrangler deploy --dry-run

# Check pages configuration  
npx wrangler pages project list
npx wrangler pages secret list --project-name webhook-dashboard

# Test local development
npm run dev  # Dashboard
npx wrangler dev  # Worker
```

## Security Considerations

1. **Environment Variables**: Always use Wrangler secrets for sensitive data
2. **JWT Validation**: Worker validates JWT tokens for all non-webhook endpoints
3. **CORS Configuration**: Review CORS settings for production domains
4. **HTTPS Only**: Both deployments enforce HTTPS by default
5. **Token Expiration**: Ensure JWT tokens have appropriate expiration times

## Rollback Procedures

### Worker Rollback
```bash
# List previous deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback [DEPLOYMENT_ID]
```

### Dashboard Rollback
```bash
# List previous deployments
npx wrangler pages deployment list --project-name webhook-dashboard

# Rollback through Cloudflare Dashboard
# Pages > webhook-dashboard > Deployments > [Select Previous] > Rollback
```

---

## Quick Deployment Checklist

- [ ] Node.js v20+ installed
- [ ] Wrangler authenticated (`wrangler auth login`)
- [ ] Worker environment variables set
- [ ] Dashboard environment variables set
- [ ] D1 database created and migrated
- [ ] Worker deployed and tested
- [ ] Dashboard built and deployed
- [ ] Authentication flow verified
- [ ] API endpoints tested
- [ ] Custom domains configured (if needed)

---
