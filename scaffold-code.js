// wrangler.toml configuration:
/*
name = "webhook-fanout"
compatibility_date = "2023-12-01"

[[d1_databases]]
binding = "DB"
database_name = "webhook-fanout-db"
database_id = "your-database-id"

[vars]
WEBHOOK_PATH = "/webhook"
*/

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Initialize database on first run
    if (url.pathname === '/init') {
      return await initDatabase(env.DB);
    }
    
    // Configuration endpoints
    if (url.pathname === '/config/endpoints') {
      return await handleEndpointConfig(request, env.DB);
    }
    
    // Main webhook receiver
    if (url.pathname === env.WEBHOOK_PATH || url.pathname === '/webhook') {
      return await handleWebhook(request, env.DB);
    }
    
    // Logs endpoint
    if (url.pathname === '/logs') {
      return await getLogs(request, env.DB);
    }
    
    // List incoming webhooks
    if (url.pathname === '/webhooks') {
      return await listIncomingWebhooks(request, env.DB);
    }
    
    // Replay webhook functionality
    if (url.pathname === '/replay') {
      return await handleReplay(request, env.DB);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function initDatabase(db) {
  try {
    // Create endpoints configuration table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        headers TEXT, -- JSON string of custom headers
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create webhook logs table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_id TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
        endpoint_url TEXT,
        method TEXT,
        headers TEXT,
        body TEXT,
        status_code INTEGER,
        response_body TEXT,
        response_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create incoming webhooks summary table for easier querying
    await db.exec(`
      CREATE TABLE IF NOT EXISTS incoming_webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_id TEXT NOT NULL UNIQUE,
        method TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        content_type TEXT,
        content_length INTEGER,
        user_agent TEXT,
        source_ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for better query performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_webhook_id ON webhook_logs(webhook_id);
    `);
    
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_created_at ON webhook_logs(created_at);
    `);
    
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_incoming_created_at ON incoming_webhooks(created_at);
    `);
    
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_incoming_webhook_id ON incoming_webhooks(webhook_id);
    `);
    
    return new Response('Database initialized successfully', { status: 200 });
  } catch (error) {
    return new Response(`Database initialization failed: ${error.message}`, { status: 500 });
  }
}

async function handleEndpointConfig(request, db) {
  if (request.method === 'GET') {
    // Get all endpoints
    const { results } = await db.prepare('SELECT * FROM endpoints ORDER BY is_primary DESC, id ASC').all();
    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (request.method === 'POST') {
    // Add new endpoint
    const body = await request.json();
    const { url, is_primary = false, headers = {} } = body;
    
    if (!url) {
      return new Response('URL is required', { status: 400 });
    }
    
    // If setting as primary, unset other primaries
    if (is_primary) {
      await db.prepare('UPDATE endpoints SET is_primary = FALSE').run();
    }
    
    const result = await db.prepare(`
      INSERT INTO endpoints (url, is_primary, headers, updated_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(url, is_primary, JSON.stringify(headers)).run();
    
    return new Response(JSON.stringify({ id: result.meta.last_row_id, url, is_primary }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (request.method === 'PUT') {
    // Update endpoint
    const body = await request.json();
    const { id, url, is_primary, headers } = body;
    
    if (!id) {
      return new Response('ID is required', { status: 400 });
    }
    
    // If setting as primary, unset other primaries
    if (is_primary) {
      await db.prepare('UPDATE endpoints SET is_primary = FALSE').run();
    }
    
    await db.prepare(`
      UPDATE endpoints 
      SET url = COALESCE(?, url), 
          is_primary = COALESCE(?, is_primary), 
          headers = COALESCE(?, headers),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(url, is_primary, headers ? JSON.stringify(headers) : null, id).run();
    
    return new Response('Endpoint updated', { status: 200 });
  }
  
  if (request.method === 'DELETE') {
    // Delete endpoint
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response('ID parameter is required', { status: 400 });
    }
    
    await db.prepare('DELETE FROM endpoints WHERE id = ?').bind(id).run();
    return new Response('Endpoint deleted', { status: 200 });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

async function handleWebhook(request, db) {
  const webhookId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Log incoming webhook
    const incomingHeaders = {};
    for (const [key, value] of request.headers.entries()) {
      incomingHeaders[key] = value;
    }
    
    const body = await request.text();
    const contentType = request.headers.get('content-type') || '';
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    const userAgent = request.headers.get('user-agent') || '';
    const sourceIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
    
    // Log to incoming webhooks table
    await db.prepare(`
      INSERT INTO incoming_webhooks 
      (webhook_id, method, headers, body, content_type, content_length, user_agent, source_ip) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      webhookId, 
      request.method, 
      JSON.stringify(incomingHeaders), 
      body, 
      contentType, 
      contentLength, 
      userAgent, 
      sourceIp
    ).run();
    
    // Also log to webhook_logs for consistency
    await logWebhook(db, webhookId, 'incoming', null, request.method, incomingHeaders, body, null, null, null);
    
    return await processWebhookFanout(db, webhookId, request.method, incomingHeaders, body);
    
  } catch (error) {
    console.error('Webhook handling error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function processWebhookFanout(db, webhookId, method, incomingHeaders, body) {
  // Get all endpoints
  const { results: endpoints } = await db.prepare('SELECT * FROM endpoints ORDER BY is_primary DESC').all();
  
  if (endpoints.length === 0) {
    // No endpoints configured, return success
    return new Response('OK', { status: 200 });
  }
  
  // Find primary endpoint
  const primaryEndpoint = endpoints.find(ep => ep.is_primary);
  const fanoutEndpoints = endpoints.filter(ep => !ep.is_primary);
  
  let primaryResponse = null;
  let primarySuccess = false;
  
  // Process primary endpoint first if exists
  if (primaryEndpoint) {
    try {
      const result = await sendWebhook(primaryEndpoint, method, incomingHeaders, body);
      primaryResponse = result.response;
      primarySuccess = result.success;
      
      await logWebhook(
        db, webhookId, 'outgoing', primaryEndpoint.url, method, 
        incomingHeaders, body, result.status, result.responseText, result.responseTime
      );
    } catch (error) {
      await logWebhook(
        db, webhookId, 'outgoing', primaryEndpoint.url, method, 
        incomingHeaders, body, 0, `Error: ${error.message}`, Date.now() - Date.now()
      );
    }
  }
  
  // Fanout to other endpoints (async, don't wait)
  if (fanoutEndpoints.length > 0) {
    // Use waitUntil to ensure fanout completes but don't block response
    const fanoutPromises = fanoutEndpoints.map(async (endpoint) => {
      try {
        const result = await sendWebhook(endpoint, method, incomingHeaders, body);
        await logWebhook(
          db, webhookId, 'outgoing', endpoint.url, method, 
          incomingHeaders, body, result.status, result.responseText, result.responseTime
        );
      } catch (error) {
        await logWebhook(
          db, webhookId, 'outgoing', endpoint.url, method, 
          incomingHeaders, body, 0, `Error: ${error.message}`, 0
        );
      }
    });
    
    // Don't await fanout, let it run in background
    Promise.all(fanoutPromises).catch(console.error);
  }
  
  // Return response based on scenarios
  if (primarySuccess && primaryResponse) {
    // Scenario 1: Forward primary endpoint response
    return primaryResponse;
  } else {
    // Scenario 2: Primary failed or doesn't exist, return success
    return new Response('OK', { status: 200 });
  }
}

async function sendWebhook(endpoint, method, incomingHeaders, body) {
  const startTime = Date.now();
  
  // Prepare headers
  const headers = { ...incomingHeaders };
  
  // Add custom headers from endpoint configuration
  if (endpoint.headers) {
    try {
      const customHeaders = JSON.parse(endpoint.headers);
      Object.assign(headers, customHeaders);
    } catch (e) {
      console.warn('Failed to parse custom headers for endpoint:', endpoint.url);
    }
  }
  
  // Remove hop-by-hop headers
  delete headers['host'];
  delete headers['connection'];
  delete headers['keep-alive'];
  delete headers['proxy-authenticate'];
  delete headers['proxy-authorization'];
  delete headers['te'];
  delete headers['trailers'];
  delete headers['transfer-encoding'];
  delete headers['upgrade'];
  
  const response = await fetch(endpoint.url, {
    method: method,
    headers: headers,
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
  });
  
  const responseTime = Date.now() - startTime;
  const responseText = await response.text();
  
  return {
    response: new Response(responseText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    }),
    success: response.ok,
    status: response.status,
    responseText,
    responseTime
  };
}

async function logWebhook(db, webhookId, direction, endpointUrl, method, headers, body, statusCode, responseBody, responseTime) {
  try {
    await db.prepare(`
      INSERT INTO webhook_logs 
      (webhook_id, direction, endpoint_url, method, headers, body, status_code, response_body, response_time_ms) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      webhookId,
      direction,
      endpointUrl,
      method,
      JSON.stringify(headers),
      body,
      statusCode,
      responseBody,
      responseTime
    ).run();
  } catch (error) {
    console.error('Failed to log webhook:', error);
  }
}

async function getLogs(request, db) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const webhookId = url.searchParams.get('webhook_id');
    
    let query = 'SELECT * FROM webhook_logs';
    let params = [];
    
    if (webhookId) {
      query += ' WHERE webhook_id = ?';
      params.push(webhookId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const { results } = await db.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(`Failed to fetch logs: ${error.message}`, { status: 500 });
  }
}

async function listIncomingWebhooks(request, db) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end') || new Date().toISOString();
    
    let query = 'SELECT webhook_id, method, content_type, content_length, user_agent, source_ip, created_at FROM incoming_webhooks';
    let params = [];
    
    if (startDate) {
      query += ' WHERE created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const { results } = await db.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({
      webhooks: results,
      total: results.length,
      filters: {
        start_date: startDate,
        end_date: endDate,
        limit
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(`Failed to fetch incoming webhooks: ${error.message}`, { status: 500 });
  }
}

async function handleReplay(request, db) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const body = await request.json();
    const { webhook_id, start_date, end_date } = body;
    
    if (!webhook_id && !start_date) {
      return new Response('Either webhook_id or start_date is required', { status: 400 });
    }
    
    let webhooksToReplay = [];
    
    if (webhook_id) {
      // Replay specific webhook
      const { results } = await db.prepare(
        'SELECT * FROM incoming_webhooks WHERE webhook_id = ?'
      ).bind(webhook_id).all();
      
      if (results.length === 0) {
        return new Response('Webhook not found', { status: 404 });
      }
      
      webhooksToReplay = results;
    } else {
      // Replay webhooks in date range
      const endDateFinal = end_date || new Date().toISOString();
      const { results } = await db.prepare(
        'SELECT * FROM incoming_webhooks WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC'
      ).bind(start_date, endDateFinal).all();
      
      webhooksToReplay = results;
    }
    
    if (webhooksToReplay.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No webhooks found to replay',
        replayed: 0 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Process replays
    const replayResults = [];
    
    for (const webhook of webhooksToReplay) {
      try {
        const originalHeaders = JSON.parse(webhook.headers);
        const newWebhookId = crypto.randomUUID();
        
        // Log the replay as a new incoming webhook
        await db.prepare(`
          INSERT INTO incoming_webhooks 
          (webhook_id, method, headers, body, content_type, content_length, user_agent, source_ip) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newWebhookId, 
          webhook.method, 
          webhook.headers + ' [REPLAY]', // Mark as replay
          webhook.body, 
          webhook.content_type, 
          webhook.content_length, 
          webhook.user_agent + ' [REPLAY]', 
          webhook.source_ip
        ).run();
        
        // Process the fanout
        await processWebhookFanout(db, newWebhookId, webhook.method, originalHeaders, webhook.body);
        
        replayResults.push({
          original_webhook_id: webhook.webhook_id,
          new_webhook_id: newWebhookId,
          method: webhook.method,
          original_date: webhook.created_at,
          status: 'success'
        });
        
      } catch (error) {
        replayResults.push({
          original_webhook_id: webhook.webhook_id,
          method: webhook.method,
          original_date: webhook.created_at,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return new Response(JSON.stringify({
      message: `Replayed ${replayResults.length} webhooks`,
      replayed: replayResults.length,
      results: replayResults
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(`Failed to replay webhooks: ${error.message}`, { status: 500 });
  }
}