# Webhook Dashboard

A Next.js-based management dashboard for the Webhook Fanout Service, providing real-time monitoring, endpoint management, and webhook replay capabilities.

## Features

- **Real-time Webhook Monitoring**: Live view of incoming webhooks and processing status
- **Endpoint Management**: Full CRUD interface for managing webhook endpoints
- **Interactive Logs**: Expandable log entries with formatted JSON and headers
- **Bulk Operations**: Select and replay multiple webhooks simultaneously  
- **Pagination**: Efficient browsing of large webhook histories
- **Authentication**: Secure access with Keycloak/NextAuth integration

## Authentication with Keycloak

The dashboard uses **Keycloak** for enterprise-grade authentication:

### Features:
- **Single Sign-On (SSO)**: Centralized authentication across your organization
- **Role-based Access Control**: Manage user permissions through Keycloak roles
- **Session Management**: Secure login/logout with automatic token refresh
- **Multi-factor Authentication**: Optional MFA support
- **User Management**: Centralized user accounts and password policies

### Setup Requirements:
1. **Keycloak Instance**: Running Keycloak server (v15+ recommended)
2. **Client Configuration**: OpenID Connect client in your Keycloak realm
3. **Environment Variables**: Keycloak endpoints and credentials in `.env.local`
4. **Redirect URIs**: Properly configured callback URLs

See the main [README.md](../README.md) for detailed Keycloak setup instructions.

## Quick Start

See the main [README.md](../README.md) for complete setup and deployment instructions.

### Development

```bash
# Install dependencies
npm install

# Set up environment variables (see ../README.md)
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Build for Production

```bash
# Build for Cloudflare Pages
npm run pages:build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .vercel/output/static --project-name webhook-dashboard
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Authentication**: NextAuth.js v5 with Keycloak provider
- **Styling**: Tailwind CSS
- **Deployment**: Cloudflare Pages with Edge Runtime
- **TypeScript**: Full type safety

## API Integration

The dashboard integrates with the webhook worker API for:
- Endpoint configuration management
- Webhook log retrieval and analysis
- Webhook replay operations
- Real-time status monitoring

For complete documentation, see the main [README.md](../README.md).
