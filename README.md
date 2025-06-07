# Webhook Fanout Service

A production-ready serverless webhook proxy service built on Cloudflare Workers that receives webhooks and intelligently fans them out to multiple configured endpoints with comprehensive logging and replay capabilities.

![Webhook Fanout Architecture](https://img.shields.io/badge/Cloudflare-Workers-orange) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Hono](https://img.shields.io/badge/Hono-4-green)

## 🚀 Features

### Core Webhook Processing
- **Intelligent Fanout**: Receives webhooks and forwards to multiple configured endpoints
- **Primary Endpoint Logic**: Returns primary endpoint response or 200 OK fallback
- **Async Processing**: Secondary endpoints called asynchronously for optimal performance
- **Header Preservation**: Forwards original headers and request body to all endpoints

### Endpoint Management
- **REST API**: Full CRUD operations for endpoint management
- **Primary Designation**: Single primary endpoint for response handling
- **Custom Headers**: Configure custom headers per endpoint
- **Dynamic Configuration**: Update endpoints without service restarts

### Comprehensive Logging
- **Full Request/Response Logging**: Captures all incoming webhooks and outgoing requests
- **Unique Webhook IDs**: UUID-based tracking for easy correlation
- **Response Time Tracking**: Performance monitoring for all endpoint calls
- **Searchable History**: Query logs by date range, webhook ID, or endpoint

### Advanced Replay System
- **Individual Webhook Replay**: Replay specific webhooks by UUID
- **Bulk Date Range Replay**: Replay all webhooks from a time period
- **Selective Endpoint Replay**: Target specific endpoints for replay operations
- **Current Configuration**: Uses current endpoint configuration for replays

### Production Dashboard
- **Real-time Monitoring**: Live view of webhook processing and endpoint health
- **Interactive Logs**: Expandable log entries with formatted JSON and headers
- **Bulk Operations**: Select and replay multiple webhooks simultaneously
- **Pagination**: Efficient browsing of large webhook histories
- **Authentication**: Secure access with Keycloak/NextAuth integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Webhook       │    │  Cloudflare      │    │   Target        │
│   Sender        │───▶│  Worker          │───▶│   Endpoints     │
│                 │    │  (Fanout)        │    │   (Multiple)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  D1 Database     │
                       │  (Logs & Config) │
                       └──────────────────┘
                                ▲
                                │
                       ┌──────────────────┐
                       │  Next.js         │
                       │  Dashboard       │
                       └──────────────────┘
```

### Components

1. **Webhook Worker** (`webhook-fanout-worker/`): Hono-based Cloudflare Worker
   - Webhook reception and fanout logic
   - Endpoint configuration management
   - Request/response logging
   - JWT authentication validation

2. **Management Dashboard** (`webhook-dashboard/`): Next.js application
   - Web interface for endpoint management
   - Real-time logs and monitoring
   - Webhook replay functionality
   - Keycloak authentication integration

3. **D1 Database**: Cloudflare's edge SQL database
   - Endpoint configurations
   - Webhook logs and metadata
   - Response tracking and history

## 📋 API Reference

### Webhook Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `POST` | `/webhook` | Receive webhooks | ❌ |
| `GET` | `/health` | Health check | ❌ |

### Management Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/config/endpoints` | List endpoints | ✅ |
| `POST` | `/config/endpoints` | Create endpoint | ✅ |
| `PUT` | `/config/endpoints/:id` | Update endpoint | ✅ |
| `DELETE` | `/config/endpoints/:id` | Delete endpoint | ✅ |

### Logging & Replay

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/logs` | View webhook logs | ✅ |
| `GET` | `/webhooks` | List incoming webhooks | ✅ |
| `POST` | `/replay/webhook/:uuid` | Replay by webhook ID | ✅ |
| `POST` | `/replay/range` | Replay by date range | ✅ |
| `DELETE` | `/logs` | Clear webhook logs | ✅ |
| `DELETE` | `/webhooks` | Clear incoming webhooks | ✅ |

### Data Management

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/init` | Initialize database | ✅ |

## 🛠️ Quick Start

### Prerequisites

- **Node.js** v20.0.0 or higher
- **Cloudflare Account** with Workers and Pages access
- **Keycloak Instance** (for authentication)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/webhook-fanout-service.git
cd webhook-fanout-service
```

### 2. Install Dependencies

```bash
# Install worker dependencies
cd webhook-fanout-worker
npm install

# Install dashboard dependencies  
cd ../webhook-dashboard
npm install
```

### 3. Set Up Keycloak Authentication

The service uses **Keycloak** for enterprise-grade authentication and authorization. You'll need a running Keycloak instance to use the management dashboard.

#### Keycloak Configuration

1. **Create a Keycloak Realm** (or use an existing one)
2. **Create a Client** with these settings:
   - **Client ID**: `webhook-dashboard` (or your preferred name)
   - **Client Type**: `OpenID Connect`
   - **Client Authentication**: `On` (for confidential client)
   - **Valid Redirect URIs**: 
     - `http://localhost:3000/api/auth/callback/keycloak` (development)
     - `https://your-domain.pages.dev/api/auth/callback/keycloak` (production)
   - **Web Origins**: `http://localhost:3000` and your production domain

3. **Create Users** and assign appropriate roles for dashboard access

#### Environment Variables

**Worker (`webhook-fanout-worker/.env.local`):**
```bash
NEXTAUTH_SECRET="your-jwt-secret-key-32-chars-min"
KEYCLOAK_ISSUER="https://your-keycloak.com/realms/your-realm"
KEYCLOAK_CLIENT_ID="webhook-dashboard"
```

**Dashboard (`webhook-dashboard/.env.local`):**
```bash
NEXTAUTH_SECRET="your-jwt-secret-key-32-chars-min"
NEXTAUTH_URL="http://localhost:3000"
KEYCLOAK_CLIENT_ID="webhook-dashboard"
KEYCLOAK_CLIENT_SECRET="your-client-secret-from-keycloak"
KEYCLOAK_ISSUER="https://your-keycloak.com/realms/your-realm"
NEXT_PUBLIC_WORKER_API_URL="http://localhost:8787"
```

> **Note**: The webhook endpoint (`/webhook`) does **not** require authentication and can be called directly by external services. Only the management API endpoints require JWT authentication.

### 4. Initialize Database

```bash
cd webhook-fanout-worker
npx wrangler d1 create webhook-fanout-db
npx wrangler d1 migrations apply webhook-fanout-db --local
```

### 5. Start Development Servers

```bash
# Terminal 1: Start worker
cd webhook-fanout-worker
npm run dev

# Terminal 2: Start dashboard  
cd webhook-dashboard
npm run dev
```

### 6. Access Applications

- **Dashboard**: http://localhost:3000
- **Worker API**: http://localhost:8787
- **Webhook Endpoint**: http://localhost:8787/webhook

## 🚢 Production Deployment

### Deploy to Cloudflare

#### 1. Install Wrangler CLI

```bash
npm install -g wrangler
npx wrangler auth login
```

#### 2. Deploy Worker

```bash
cd webhook-fanout-worker

# Set production secrets
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put KEYCLOAK_ISSUER
npx wrangler secret put KEYCLOAK_CLIENT_ID

# Create and migrate database
npx wrangler d1 create webhook-fanout-db
npx wrangler d1 migrations apply webhook-fanout-db --remote

# Deploy worker
npx wrangler deploy
```

#### 3. Deploy Dashboard

```bash
cd webhook-dashboard

# Set production secrets
npx wrangler pages secret put NEXTAUTH_SECRET
npx wrangler pages secret put NEXTAUTH_URL  # https://your-domain.pages.dev
npx wrangler pages secret put KEYCLOAK_CLIENT_ID
npx wrangler pages secret put KEYCLOAK_CLIENT_SECRET
npx wrangler pages secret put KEYCLOAK_ISSUER
npx wrangler pages secret put NEXT_PUBLIC_WORKER_API_URL

# Build and deploy
npm run pages:build
npx wrangler pages deploy .vercel/output/static --project-name webhook-dashboard
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 🔧 Configuration

### Endpoint Configuration

Each endpoint can be configured with:

```json
{
  "name": "Production API",
  "url": "https://api.example.com/webhooks",
  "isPrimary": true,
  "customHeaders": {
    "Authorization": "Bearer token",
    "X-Custom-Header": "value"
  },
  "active": true
}
```

### Response Logic

1. **Primary Endpoint Success**: Returns complete response from primary endpoint
2. **Primary Endpoint Failure**: Returns `200 OK` to webhook sender
3. **No Primary Endpoint**: Returns `200 OK` to webhook sender
4. **Secondary Endpoints**: Called asynchronously, don't affect response

### Authentication Flow

The service implements a secure authentication flow using **Keycloak** and **JWT tokens**:

#### For Dashboard Users:
1. **Login**: Users authenticate through Keycloak via the dashboard
2. **Token Generation**: NextAuth.js generates JWT tokens containing user claims
3. **API Requests**: Dashboard sends JWT tokens in `Authorization: Bearer <token>` headers
4. **Token Validation**: Worker validates JWT signature, expiration, and issuer

#### For External Services:
- **Webhook Endpoint**: `/webhook` is **publicly accessible** (no authentication required)
- **Management APIs**: All configuration and monitoring endpoints require valid JWT tokens

#### Security Features:
- **JWT Signature Validation**: Cryptographic verification using shared secret
- **Token Expiration**: Automatic token refresh and session management
- **Issuer Validation**: Ensures tokens come from trusted Keycloak instance
- **Role-based Access**: Keycloak roles can control dashboard permissions

## 📊 Monitoring

### Built-in Monitoring

- **Health Checks**: `/health` endpoint for uptime monitoring
- **Response Time Tracking**: All endpoint calls are timed and logged
- **Error Logging**: Failed requests logged with full error details
- **Processing Status**: Track webhook processing completion

### Cloudflare Analytics

- **Worker Analytics**: Built-in Cloudflare Workers analytics
- **Pages Analytics**: Real-time dashboard performance metrics
- **D1 Analytics**: Database query performance and usage

### Log Analysis

```bash
# Real-time worker logs
npx wrangler tail webhook-fanout-worker

# Dashboard deployment logs
npx wrangler pages deployment tail webhook-dashboard
```

## 🔐 Security

### Keycloak Authentication & Authorization

The service leverages **Keycloak** for comprehensive identity and access management:

#### Keycloak Features Used:
- **OpenID Connect**: Standard protocol for authentication
- **JWT Tokens**: Stateless authentication with cryptographic signatures
- **User Management**: Centralized user accounts and credentials
- **Role-based Access Control**: Granular permissions for dashboard features
- **Session Management**: Secure login/logout with token refresh
- **Multi-factor Authentication**: Optional MFA support through Keycloak

#### Token Security:
- **Signature Verification**: JWT tokens signed with shared secret (NEXTAUTH_SECRET)
- **Expiration Validation**: Automatic token expiry and refresh handling
- **Issuer Validation**: Ensures tokens originate from trusted Keycloak instance
- **Audience Validation**: Verifies tokens are intended for this service

#### Access Control:
- **Public Webhook Endpoint**: `/webhook` accessible without authentication
- **Protected Management APIs**: All configuration endpoints require valid JWT
- **Role-based Permissions**: Keycloak roles can control dashboard access levels
- **Session-based Dashboard**: Secure browser sessions with automatic token handling

### Data Protection
- **HTTPS Only**: All traffic encrypted in transit
- **Environment Secrets**: Sensitive configuration stored as Cloudflare secrets
- **Database Encryption**: D1 database encrypted at rest
- **Secret Rotation**: Support for rotating JWT signing keys

### Security Headers & Protection
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Content Security Policy**: XSS protection for dashboard
- **Rate Limiting**: Built-in Cloudflare DDoS protection
- **Input Validation**: All API inputs validated and sanitized

## 🧪 Testing

### Running Tests

```bash
# Worker tests
cd webhook-fanout-worker
npm test

# Dashboard tests  
cd webhook-dashboard
npm test
```

### Manual Testing

```bash
# Test webhook endpoint
curl -X POST "http://localhost:8787/webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook data"}'

# Test authenticated endpoint
curl -X GET "http://localhost:8787/logs" \
  -H "Authorization: Bearer your-jwt-token"
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Follow the configured linting rules
- **Prettier**: Code formatting enforced
- **Conventional Commits**: Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

**Keycloak Authentication Issues**
```bash
# Check Keycloak configuration
# 1. Verify KEYCLOAK_ISSUER URL is accessible
curl "https://your-keycloak.com/realms/your-realm/.well-known/openid_configuration"

# 2. Verify client configuration in Keycloak admin console
# 3. Check redirect URIs match your dashboard URL
# 4. Ensure client secret matches KEYCLOAK_CLIENT_SECRET
```

**JWT Token Validation Errors**
```bash
# Verify shared secret matches between dashboard and worker
# Check NEXTAUTH_SECRET is identical in both .env files

# Test JWT token manually
curl -X GET "https://your-worker.workers.dev/logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Node.js Version Error**
```bash
# Upgrade Node.js
nvm install 20
nvm use 20
```

**Authentication Errors**
```bash
# Re-authenticate with Cloudflare
npx wrangler auth login
```

**Database Errors**
```bash
# Recreate and migrate database
npx wrangler d1 create webhook-fanout-db
npx wrangler d1 migrations apply webhook-fanout-db --remote
```

### Getting Help

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and tips
- **Documentation**: Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup instructions

### Performance Optimization

- **Edge Deployment**: Automatically deployed to Cloudflare's global edge network
- **Cold Start Optimization**: Minimal dependencies for fast worker startup
- **Database Optimization**: Indexed queries for efficient log retrieval
- **Caching Strategy**: Appropriate caching headers for static assets

---

**Built with ❤️ using Cloudflare Workers, Next.js, and TypeScript**
