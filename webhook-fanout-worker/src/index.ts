import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDB } from './db';
import { endpoints, webhookLogs, incomingWebhooks } from './db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

type Bindings = {
  DB: D1Database;
  WEBHOOK_PATH: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({ 
    service: 'Webhook Fanout Service',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Initialize database (for development)
app.get('/init', async (c) => {
  try {
    const db = createDB(c.env.DB);
    // The tables are already created via migrations
    // This endpoint can be used for seeding data if needed
    return c.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', error);
    return c.json({ error: 'Failed to initialize database' }, 500);
  }
});

// Endpoint configuration routes
app.get('/config/endpoints', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const allEndpoints = await db.select().from(endpoints).orderBy(desc(endpoints.createdAt));
    return c.json({ endpoints: allEndpoints });
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    return c.json({ error: 'Failed to fetch endpoints' }, 500);
  }
});

app.post('/config/endpoints', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const body = await c.req.json();
    
    const { url, isPrimary = false, headers = {}, tenantId } = body;
    
    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // If setting as primary, unset all other primary endpoints
    if (isPrimary) {
      await db.update(endpoints)
        .set({ isPrimary: false })
        .where(eq(endpoints.isPrimary, true));
    }

    const [newEndpoint] = await db.insert(endpoints).values({
      url,
      isPrimary,
      headers: JSON.stringify(headers),
      tenantId,
    }).returning();

    return c.json({ endpoint: newEndpoint }, 201);
  } catch (error) {
    console.error('Error creating endpoint:', error);
    return c.json({ error: 'Failed to create endpoint' }, 500);
  }
});

// Update endpoint
app.patch('/config/endpoints/:id', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    const { url, isPrimary, headers, tenantId, isActive } = body;
    
    // If setting as primary, unset all other primary endpoints
    if (isPrimary === true) {
      await db.update(endpoints)
        .set({ isPrimary: false })
        .where(eq(endpoints.isPrimary, true));
    }

    const updateData: any = {};
    if (url !== undefined) updateData.url = url;
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
    if (headers !== undefined) updateData.headers = JSON.stringify(headers);
    if (tenantId !== undefined) updateData.tenantId = tenantId;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    updateData.updatedAt = new Date().toISOString();

    const [updatedEndpoint] = await db.update(endpoints)
      .set(updateData)
      .where(eq(endpoints.id, id))
      .returning();

    if (!updatedEndpoint) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    return c.json({ endpoint: updatedEndpoint });
  } catch (error) {
    console.error('Error updating endpoint:', error);
    return c.json({ error: 'Failed to update endpoint' }, 500);
  }
});

// Delete endpoint
app.delete('/config/endpoints/:id', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const id = parseInt(c.req.param('id'));
    
    const [deletedEndpoint] = await db.delete(endpoints)
      .where(eq(endpoints.id, id))
      .returning();

    if (!deletedEndpoint) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    return c.json({ message: 'Endpoint deleted successfully' });
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    return c.json({ error: 'Failed to delete endpoint' }, 500);
  }
});

// Get webhook logs
app.get('/logs', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const limit = parseInt(c.req.query('limit') || '100');
    const endpointUrl = c.req.query('endpoint');
    const endpointId = c.req.query('endpointId');

    let whereConditions = [];
    
    if (endpointUrl) {
      whereConditions.push(eq(webhookLogs.endpointUrl, endpointUrl));
    } else if (endpointId) {
      // Join with endpoints table to filter by endpoint ID
      const endpointRecord = await db.select().from(endpoints).where(eq(endpoints.id, parseInt(endpointId))).limit(1);
      if (endpointRecord.length > 0) {
        whereConditions.push(eq(webhookLogs.endpointUrl, endpointRecord[0].url));
      }
    }
    
    let query = db.select().from(webhookLogs);
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    const logs = await query.orderBy(desc(webhookLogs.createdAt)).limit(limit);
    
    return c.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return c.json({ error: 'Failed to fetch logs' }, 500);
  }
});

// Replay webhook by ID
app.post('/replay/:webhookId', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const webhookId = c.req.param('webhookId');
    
    // Get the original webhook
    const [originalWebhook] = await db.select()
      .from(incomingWebhooks)
      .where(eq(incomingWebhooks.id, webhookId))
      .limit(1);

    if (!originalWebhook) {
      return c.json({ error: 'Webhook not found' }, 404);
    }

    // Get current active endpoints
    const activeEndpoints = await db.select()
      .from(endpoints)
      .where(eq(endpoints.isActive, true));

    if (activeEndpoints.length === 0) {
      return c.json({ error: 'No active endpoints configured' }, 500);
    }

    // Create new webhook ID for replay
    const replayWebhookId = crypto.randomUUID();
    
    // Log the replay attempt
    await db.insert(incomingWebhooks).values({
      id: replayWebhookId,
      method: originalWebhook.method,
      headers: originalWebhook.headers,
      body: originalWebhook.body,
      sourceIp: 'replay',
      userAgent: 'webhook-replay',
      processingStatus: 'replaying',
    });

    // Process webhook fanout with current endpoints
    const headers = originalWebhook.headers ? JSON.parse(originalWebhook.headers) : {};
    await processWebhookFanout(
      db, 
      replayWebhookId, 
      originalWebhook.method, 
      headers, 
      originalWebhook.body || '', 
      activeEndpoints
    );

    return c.json({ message: 'Webhook replayed successfully', replayWebhookId });
  } catch (error) {
    console.error('Error replaying webhook:', error);
    return c.json({ error: 'Failed to replay webhook' }, 500);
  }
});

// Replay webhooks by date range
app.post('/replay', async (c) => {
  try {
    const db = createDB(c.env.DB);
    const body = await c.req.json();
    const { startDate, endDate } = body;
    
    if (!startDate || !endDate) {
      return c.json({ error: 'startDate and endDate are required' }, 400);
    }

    // Get webhooks in date range
    const webhooks = await db.select()
      .from(incomingWebhooks)
      .where(
        // Using string comparison for SQLite datetime format
        `created_at >= '${startDate}' AND created_at <= '${endDate}'`
      )
      .orderBy(desc(incomingWebhooks.createdAt));

    if (webhooks.length === 0) {
      return c.json({ message: 'No webhooks found in date range', count: 0 });
    }

    // Get current active endpoints
    const activeEndpoints = await db.select()
      .from(endpoints)
      .where(eq(endpoints.isActive, true));

    if (activeEndpoints.length === 0) {
      return c.json({ error: 'No active endpoints configured' }, 500);
    }

    let replayCount = 0;
    
    // Replay each webhook
    for (const webhook of webhooks) {
      try {
        const replayWebhookId = crypto.randomUUID();
        
        // Log the replay attempt
        await db.insert(incomingWebhooks).values({
          id: replayWebhookId,
          method: webhook.method,
          headers: webhook.headers,
          body: webhook.body,
          sourceIp: 'replay-batch',
          userAgent: 'webhook-replay-batch',
          processingStatus: 'replaying',
        });

        // Process webhook fanout
        const headers = webhook.headers ? JSON.parse(webhook.headers) : {};
        await processWebhookFanout(
          db, 
          replayWebhookId, 
          webhook.method, 
          headers, 
          webhook.body || '', 
          activeEndpoints
        );
        
        replayCount++;
      } catch (error) {
        console.error(`Error replaying webhook ${webhook.id}:`, error);
        // Continue with other webhooks
      }
    }

    return c.json({ 
      message: 'Webhook batch replay completed', 
      totalFound: webhooks.length,
      successfulReplays: replayCount 
    });
  } catch (error) {
    console.error('Error replaying webhooks:', error);
    return c.json({ error: 'Failed to replay webhooks' }, 500);
  }
});

// Main webhook receiver
app.all('/webhook', async (c) => {
  return handleWebhook(c);
});

// Support custom webhook path from environment
app.all('/*', async (c) => {
  const webhookPath = c.env.WEBHOOK_PATH || '/webhook';
  if (c.req.path === webhookPath) {
    return handleWebhook(c);
  }
  return c.json({ error: 'Not Found' }, 404);
});

async function handleWebhook(c: any) {
  try {
    const db = createDB(c.env.DB);
    const webhookId = crypto.randomUUID();
    const method = c.req.method;
    const headers = Object.fromEntries(c.req.raw.headers);
    const body = await c.req.text();
    
    // Log incoming webhook
    await db.insert(incomingWebhooks).values({
      id: webhookId,
      method,
      headers: JSON.stringify(headers),
      body,
      sourceIp: c.req.header('cf-connecting-ip') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown',
    });

    // Get all active endpoints
    const activeEndpoints = await db.select()
      .from(endpoints)
      .where(eq(endpoints.isActive, true));

    if (activeEndpoints.length === 0) {
      return c.json({ error: 'No active endpoints configured' }, 500);
    }

    // Process webhooks
    const results = await processWebhookFanout(db, webhookId, method, headers, body, activeEndpoints);
    
    // Return primary endpoint response or fallback
    const primaryResult = results.find(r => r.isPrimary);
    if (primaryResult && primaryResult.success) {
      return new Response(primaryResult.responseBody, {
        status: primaryResult.statusCode,
        headers: primaryResult.responseHeaders,
      });
    }

    // Fallback to 200 OK
    return c.json({ message: 'Webhook processed successfully' }, 200);
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

async function processWebhookFanout(
  db: any,
  webhookId: string,
  method: string,
  incomingHeaders: any,
  body: string,
  endpointList: any[]
) {
  const results = [];
  
  for (const endpoint of endpointList) {
    try {
      const startTime = Date.now();
      const customHeaders = endpoint.headers ? JSON.parse(endpoint.headers) : {};
      
      // Merge incoming headers with custom headers (custom headers take precedence)
      const requestHeaders = {
        ...incomingHeaders,
        ...customHeaders,
      };
      
      // Remove host header to avoid conflicts
      delete requestHeaders.host;
      
      const response = await fetch(endpoint.url, {
        method,
        headers: requestHeaders,
        body: method !== 'GET' ? body : undefined,
      });
      
      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();
      
      // Log the outgoing request
      await db.insert(webhookLogs).values({
        webhookId,
        direction: 'outgoing',
        endpointUrl: endpoint.url,
        method,
        headers: JSON.stringify(requestHeaders),
        body,
        statusCode: response.status,
        responseBody,
        responseTime,
      });
      
      results.push({
        endpointId: endpoint.id,
        isPrimary: endpoint.isPrimary,
        success: response.ok,
        statusCode: response.status,
        responseBody,
        responseHeaders: Object.fromEntries(response.headers),
        responseTime,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error calling endpoint ${endpoint.url}:`, error);
      
      // Log the failed request
      await db.insert(webhookLogs).values({
        webhookId,
        direction: 'outgoing',
        endpointUrl: endpoint.url,
        method,
        headers: JSON.stringify(incomingHeaders),
        body,
        statusCode: 0,
        responseBody: `Error: ${errorMessage}`,
        responseTime: 0,
      });
      
      results.push({
        endpointId: endpoint.id,
        isPrimary: endpoint.isPrimary,
        success: false,
        statusCode: 0,
        error: errorMessage,
      });
    }
  }
  
  return results;
}

// Export as Cloudflare Workers handler
export default app;
