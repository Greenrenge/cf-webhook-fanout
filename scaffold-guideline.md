# Webhook Fanout Worker - Deployment & Usage Guide

## Prerequisites
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)

## Setup

### 1. Create wrangler.toml
```toml
name = "webhook-fanout"
compatibility_date = "2023-12-01"

[[d1_databases]]
binding = "DB"
database_name = "webhook-fanout-db"
database_id = "your-database-id"

[vars]
WEBHOOK_PATH = "/webhook"
```

### 2. Create D1 Database
```bash
# Create the database
wrangler d1 create webhook-fanout-db

# Copy the database_id from output and update wrangler.toml
```

### 3. Deploy the Worker
```bash
# Deploy to Cloudflare
wrangler deploy

# Initialize the database
curl https://your-worker.your-subdomain.workers.dev/init
```

## API Endpoints

### Initialize Database
```bash
GET /init
```
Creates the necessary tables for endpoints, logs, and incoming webhooks.

### Webhook Receiver
```bash
POST /webhook
# or any method to the configured WEBHOOK_PATH
```
Main webhook endpoint that receives external webhooks and fans out to configured endpoints.

### Endpoint Configuration

#### Get All Endpoints
```bash
GET /config/endpoints
```

#### Add New Endpoint
```bash
POST /config/endpoints
Content-Type: application/json

{
  "url": "https://api.example.com/webhook",
  "is_primary": true,
  "headers": {
    "Authorization": "Bearer token123",
    "X-Custom-Header": "value"
  }
}
```

#### Update Endpoint
```bash
PUT /config/endpoints
Content-Type: application/json

{
  "id": 1,
  "url": "https://api.example.com/webhook-v2",
  "is_primary": false,
  "headers": {
    "Authorization": "Bearer newtoken456"
  }
}
```

#### Delete Endpoint
```bash
DELETE /config/endpoints?id=1
```

### Webhook Management

#### List Incoming Webhooks
```bash
# Get recent incoming webhooks
GET /webhooks?limit=100

# Get webhooks by date range
GET /webhooks?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z&limit=50
```

#### View Detailed Logs
```bash
# Get recent logs (all incoming/outgoing)
GET /logs?limit=100

# Get logs for specific webhook
GET /logs?webhook_id=uuid-here&limit=50
```

#### Replay Webhooks
```bash
# Replay specific webhook by ID
POST /replay
Content-Type: application/json

{
  "webhook_id": "abc-123-def-456"
}

# Replay webhooks by date range
POST /replay
Content-Type: application/json

{
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-01T23:59:59Z"
}

# Replay from start date to now
POST /replay
Content-Type: application/json

{
  "start_date": "2024-01-01T00:00:00Z"
}
```

## Usage Examples

### 1. Basic Setup
```bash
# Add primary endpoint
curl -X POST https://your-worker.your-subdomain.workers.dev/config/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://primary-api.example.com/webhook",
    "is_primary": true
  }'

# Add secondary endpoints
curl -X POST https://your-worker.your-subdomain.workers.dev/config/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://backup-api.example.com/webhook",
    "is_primary": false
  }'

curl -X POST https://your-worker.your-subdomain.workers.dev/config/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://analytics.example.com/webhook",
    "is_primary": false,
    "headers": {
      "X-API-Key": "analytics-key-123"
    }
  }'
```

### 2. Test Webhook
```bash
# Send a test webhook
curl -X POST https://your-worker.your-subdomain.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "X-Source: test-system" \
  -d '{
    "event": "user.created",
    "data": {
      "id": 123,
      "email": "user@example.com"
    }
  }'
```

### 3. Monitor and Replay Webhooks
```bash
# List recent incoming webhooks
curl https://your-worker.your-subdomain.workers.dev/webhooks

# List webhooks from specific date range
curl "https://your-worker.your-subdomain.workers.dev/webhooks?start=2024-01-01T00:00:00Z&end=2024-01-01T23:59:59Z"

# Replay a specific webhook
curl -X POST https://your-worker.your-subdomain.workers.dev/replay \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "abc-123-def-456"
  }'

# Replay all webhooks from today
curl -X POST https://your-worker.your-subdomain.workers.dev/replay \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-06-06T00:00:00Z"
  }'
```

## Behavior

### Response Logic
1. **Primary endpoint success**: Returns the exact response from the primary endpoint
2. **Primary endpoint failure or no primary**: Returns `200 OK`

### Fanout Process
- Primary endpoint is called first and its response determines the webhook response
- Secondary endpoints are called asynchronously in the background
- All requests and responses are logged to D1 database

### Logging & Replay
- Each webhook receives a unique ID and is stored in `incoming_webhooks` table
- All request/response details are logged in `webhook_logs` table
- Webhooks can be listed by date range or specific criteria
- Replay functionality allows re-sending webhooks to current endpoint configuration
- Replayed webhooks are marked with `[REPLAY]` tag and get new webhook IDs

### Replay Behavior
- **By ID**: Replays a specific webhook using its original headers and body
- **By Date Range**: Replays all webhooks within the specified time period
- **Current Endpoints**: Always uses the current endpoint configuration, not the original
- **New IDs**: Each replay gets a new webhook ID for tracking
- **Logging**: Replay attempts are fully logged like original webhooks

## Local Development

### 1. Start Local Environment
```bash
# Start local development server
wrangler dev

# Initialize local database
curl http://localhost:8787/init
```

### 2. Test Locally
```bash
# Configure endpoints locally
curl -X POST http://localhost:8787/config/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/post",
    "is_primary": true
  }'

# Test webhook
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Advanced Configuration

### Custom Headers per Endpoint
Each endpoint can have custom headers that will be added to the forwarded request:

```json
{
  "url": "https://api.example.com/webhook",
  "is_primary": true,
  "headers": {
    "Authorization": "Bearer your-token",
    "X-API-Version": "v2",
    "X-Webhook-Source": "fanout-worker"
  }
}
```

### Environment Variables
- `WEBHOOK_PATH`: Custom path for webhook receiver (default: `/webhook`)

### Database Schema
- `endpoints`: Stores endpoint configurations
- `incoming_webhooks`: Stores incoming webhook summaries with metadata
- `webhook_logs`: Stores detailed request/response logs for all webhook activity

### Replay Use Cases
1. **Disaster Recovery**: Replay failed webhooks after fixing endpoint issues
2. **Testing**: Replay webhooks against new endpoint configurations
3. **Data Migration**: Re-send webhooks to newly added endpoints
4. **Debugging**: Replay specific problematic webhooks for investigation

## Troubleshooting

### Common Issues
1. **Database not initialized**: Run `/init` endpoint first
2. **Primary endpoint not responding**: Worker will return 200 OK and log the error
3. **Headers not forwarding**: Check for hop-by-hop headers that are automatically removed
4. **Replay not working**: Ensure webhook ID exists or date range contains webhooks

### Debugging
- Check incoming webhooks via `/webhooks` endpoint
- Monitor detailed logs via `/logs` endpoint  
- Use `wrangler tail` for real-time log streaming during development
- Test replay functionality with known webhook IDs