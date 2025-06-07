# Webhook Worker

A Hono-based Cloudflare Worker that provides intelligent webhook fanout capabilities with comprehensive logging and replay functionality.

## Features

- **Webhook Reception**: Accept webhooks on configurable endpoints
- **Intelligent Fanout**: Forward webhooks to multiple configured endpoints
- **Primary Response Logic**: Return primary endpoint response or 200 OK fallback
- **Async Processing**: Non-blocking secondary endpoint calls
- **Comprehensive Logging**: Full request/response logging to D1 database
- **Replay System**: Replay webhooks by ID or date range
- **JWT Authentication**: Secure API access with token validation
- **REST API**: Full CRUD operations for endpoint management

## Quick Start

See the main [README.md](../README.md) for complete setup and deployment instructions.

### Development

```bash
# Install dependencies
npm install

# Set up environment variables (see ../README.md)  
cp .env.example .env.local

# Initialize database
npx wrangler d1 create webhook-fanout-db
npx wrangler d1 migrations apply webhook-fanout-db --local

# Start development server
npm run dev
```

The worker will be available at [http://localhost:8787](http://localhost:8787).

### Deploy to Production

```bash
# Set production secrets
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put KEYCLOAK_ISSUER
npx wrangler secret put KEYCLOAK_CLIENT_ID

# Create production database
npx wrangler d1 create webhook-fanout-db
npx wrangler d1 migrations apply webhook-fanout-db --remote

# Deploy worker
npx wrangler deploy
```

## Tech Stack

- **Framework**: Hono.js for lightweight HTTP handling
- **Runtime**: Cloudflare Workers Edge Runtime
- **Database**: Cloudflare D1 SQL database
- **ORM**: Drizzle ORM for type-safe database queries
- **Authentication**: JWT token validation with Keycloak
- **TypeScript**: Full type safety throughout

## API Endpoints

### Webhook Processing
- `POST /webhook` - Receive and process webhooks
- `GET /health` - Health check endpoint

### Endpoint Management  
- `GET /config/endpoints` - List all endpoints
- `POST /config/endpoints` - Create new endpoint
- `PUT /config/endpoints/:id` - Update endpoint
- `DELETE /config/endpoints/:id` - Delete endpoint

### Logging & Monitoring
- `GET /logs` - Retrieve webhook logs
- `GET /webhooks` - List incoming webhooks
- `DELETE /logs` - Clear webhook logs
- `DELETE /webhooks` - Clear incoming webhooks

### Replay Operations
- `POST /replay/webhook/:uuid` - Replay specific webhook
- `POST /replay/range` - Replay webhooks by date range

### Database Management
- `GET /init` - Initialize database tables

## Database Schema

The worker uses three main tables:

- **endpoints**: Webhook endpoint configurations
- **incoming_webhooks**: Incoming webhook metadata and responses
- **webhook_logs**: Detailed request/response logs for all endpoint calls

See `src/db/schema.ts` for complete schema definitions.

## Configuration

Configure endpoints with custom headers and primary designation:

```json
{
  "name": "Production API",
  "url": "https://api.example.com/webhooks", 
  "isPrimary": true,
  "customHeaders": {
    "Authorization": "Bearer token"
  },
  "active": true
}
```

For complete documentation, see the main [README.md](../README.md).
