import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDB } from './db';
import { endpoints, webhookLogs, incomingWebhooks } from './db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

type Bindings = {
	DB: D1Database;
	WEBHOOK_PATH: string;
	KEYCLOAK_ISSUER: string;
	KEYCLOAK_CLIENT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// JWT validation middleware
async function validateJWT(c: any, next: any) {
	// Skip validation for the main webhook endpoint
	const path = c.req.path;
	const method = c.req.method;

	// Allow POST requests to /webhook without authentication
	if (method === 'POST' && path.startsWith('/webhook')) {
		return next();
	}

	// Allow OPTIONS requests (CORS preflight)
	if (method === 'OPTIONS') {
		return next();
	}

	// Allow health check
	if (path === '/' || path === '/init') {
		return next();
	}

	// For all other routes, validate JWT
	const authHeader = c.req.header('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return c.json({ error: 'Missing or invalid Authorization header' }, 401);
	}

	const token = authHeader.replace('Bearer ', '');

	try {
		// Basic JWT structure validation
		const parts = token.split('.');
		if (parts.length !== 3) {
			return c.json({ error: 'Invalid JWT structure' }, 401);
		}

		// Decode the header and payload (without verification for now)
		try {
			const header = JSON.parse(atob(parts[0]));
			const payload = JSON.parse(atob(parts[1]));

			// Check if token has expired
			const now = Math.floor(Date.now() / 1000);
			if (payload.exp && payload.exp < now) {
				return c.json({ error: 'Token has expired' }, 401);
			}

			// Check issuer if available
			const expectedIssuer = c.env.KEYCLOAK_ISSUER;
			if (expectedIssuer && payload.iss && payload.iss !== expectedIssuer) {
				return c.json({ error: 'Invalid token issuer' }, 401);
			}

			// Check audience if available
			const expectedClientId = c.env.KEYCLOAK_CLIENT_ID;
			if (expectedClientId && payload.aud && !payload.aud.includes(expectedClientId)) {
				return c.json({ error: 'Invalid token audience' }, 401);
			}
		} catch (decodeError) {
			return c.json({ error: 'Invalid JWT format' }, 401);
		}

		// TODO: Add proper JWT signature verification against Keycloak public key
		// For production use, implement JWKS fetching and signature verification

		return next();
	} catch (error) {
		console.error('JWT validation error:', error);
		return c.json({ error: 'Token validation failed' }, 401);
	}
}

// Middleware
app.use('*', logger());
app.use(
	'*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
	}),
);

// Apply JWT validation middleware
app.use('*', validateJWT);

// Health check
app.get('/', (c) => {
	return c.json({
		service: 'Webhook Fanout Service',
		version: '1.0.0',
		status: 'healthy',
		timestamp: new Date().toISOString(),
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

		const { url, isPrimary = false, headers = {} } = body;

		if (!url) {
			return c.json({ error: 'URL is required' }, 400);
		}

		// If setting as primary, unset all other primary endpoints
		if (isPrimary) {
			await db.update(endpoints).set({ isPrimary: false }).where(eq(endpoints.isPrimary, true));
		}

		// Handle headers - if it's already a string (from dashboard), don't double stringify
		let headersString = '';
		if (typeof headers === 'string') {
			headersString = headers;
		} else {
			headersString = JSON.stringify(headers);
		}

		const [newEndpoint] = await db
			.insert(endpoints)
			.values({
				url,
				isPrimary,
				headers: headersString,
			})
			.returning();

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

		const { url, isPrimary, headers, isActive } = body;

		// If setting as primary, unset all other primary endpoints
		if (isPrimary === true) {
			await db.update(endpoints).set({ isPrimary: false }).where(eq(endpoints.isPrimary, true));
		}

		const updateData: any = {};
		if (url !== undefined) updateData.url = url;
		if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
		if (headers !== undefined) {
			// Handle headers - if it's already a string, don't double stringify
			if (typeof headers === 'string') {
				updateData.headers = headers;
			} else {
				updateData.headers = JSON.stringify(headers);
			}
		}
		if (isActive !== undefined) updateData.isActive = isActive;

		updateData.updatedAt = new Date().toISOString();

		const [updatedEndpoint] = await db.update(endpoints).set(updateData).where(eq(endpoints.id, id)).returning();

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

		const [deletedEndpoint] = await db.delete(endpoints).where(eq(endpoints.id, id)).returning();

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
		const skip = parseInt(c.req.query('skip') || '0');
		const endpointUrl = c.req.query('endpoint');
		const endpointId = c.req.query('endpointId');

		let whereConditions = [];

		if (endpointUrl) {
			whereConditions.push(eq(webhookLogs.endpointUrl, endpointUrl));
		} else if (endpointId) {
			// Join with endpoints table to filter by endpoint ID
			const endpointRecord = await db
				.select()
				.from(endpoints)
				.where(eq(endpoints.id, parseInt(endpointId)))
				.limit(1);
			if (endpointRecord.length > 0) {
				whereConditions.push(eq(webhookLogs.endpointUrl, endpointRecord[0].url));
			}
		}

		let logs;
		if (whereConditions.length > 0) {
			logs = await db
				.select()
				.from(webhookLogs)
				.where(and(...whereConditions))
				.orderBy(desc(webhookLogs.createdAt))
				.limit(limit)
				.offset(skip);
		} else {
			logs = await db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(limit).offset(skip);
		}

		return c.json({ logs });
	} catch (error) {
		console.error('Error fetching logs:', error);
		return c.json({ error: 'Failed to fetch logs' }, 500);
	}
});

// Get incoming webhooks
app.get('/webhooks', async (c) => {
	try {
		const db = createDB(c.env.DB);
		const limit = parseInt(c.req.query('limit') || '100');
		const skip = parseInt(c.req.query('skip') || '0');

		const webhooks = await db.select().from(incomingWebhooks).orderBy(desc(incomingWebhooks.createdAt)).limit(limit).offset(skip);

		return c.json({ webhooks });
	} catch (error) {
		console.error('Error fetching incoming webhooks:', error);
		return c.json({ error: 'Failed to fetch incoming webhooks' }, 500);
	}
});

// Delete all outgoing webhook logs
app.delete('/logs', async (c) => {
	try {
		const db = createDB(c.env.DB);
		await db.delete(webhookLogs);
		return c.json({ message: 'All webhook logs cleared successfully' });
	} catch (error) {
		console.error('Error clearing webhook logs:', error);
		return c.json({ error: 'Failed to clear webhook logs' }, 500);
	}
});

// Delete all incoming webhooks
app.delete('/webhooks', async (c) => {
	try {
		const db = createDB(c.env.DB);
		await db.delete(incomingWebhooks);
		return c.json({ message: 'All incoming webhooks cleared successfully' });
	} catch (error) {
		console.error('Error clearing incoming webhooks:', error);
		return c.json({ error: 'Failed to clear incoming webhooks' }, 500);
	}
});

// Replay webhook by ID with optional endpoint selection
app.post('/replay/:webhookId', async (c) => {
	try {
		const db = createDB(c.env.DB);
		const webhookId = c.req.param('webhookId');

		// Check for optional endpoint ID in request body
		let endpointId: number | undefined;
		try {
			const body = await c.req.json();
			endpointId = body.endpointId;
		} catch {
			// No body or invalid JSON, proceed without endpoint filtering
		}

		// Get the original webhook
		const [originalWebhook] = await db.select().from(incomingWebhooks).where(eq(incomingWebhooks.id, webhookId)).limit(1);

		if (!originalWebhook) {
			return c.json({ error: 'Webhook not found' }, 404);
		}

		// Get endpoints based on selection
		let activeEndpoints;
		if (endpointId) {
			// Replay to specific endpoint
			activeEndpoints = await db
				.select()
				.from(endpoints)
				.where(and(eq(endpoints.id, endpointId), eq(endpoints.isActive, true)));

			if (activeEndpoints.length === 0) {
				return c.json({ error: 'Endpoint not found or not active' }, 404);
			}
		} else {
			// Replay to all active endpoints
			activeEndpoints = await db.select().from(endpoints).where(eq(endpoints.isActive, true));

			if (activeEndpoints.length === 0) {
				return c.json({ error: 'No active endpoints configured' }, 500);
			}
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
			userAgent: `webhook-replay${endpointId ? `-endpoint-${endpointId}` : ''}`,
			processingStatus: 'pending',
		});

		// Process webhook fanout with selected endpoints
		const headers = originalWebhook.headers ? JSON.parse(originalWebhook.headers) : {};
		const results = await processWebhookFanout(
			db,
			replayWebhookId,
			originalWebhook.method,
			headers,
			originalWebhook.body || '',
			activeEndpoints,
		);

		// Update processing status based on results
		const primaryResult = results.find((r) => r.isPrimary);
		let processingStatus = 'completed';
		let responseStatus: number | undefined;
		let responseBody: string | undefined;

		if (primaryResult) {
			processingStatus = primaryResult.success ? 'completed' : 'failed';
			responseStatus = primaryResult.statusCode;
			responseBody = primaryResult.responseBody;
		} else {
			processingStatus = results.some((r) => r.success) ? 'completed' : 'failed';
			// Use first successful result for response data if no primary
			const firstSuccess = results.find((r) => r.success);
			if (firstSuccess) {
				responseStatus = firstSuccess.statusCode;
				responseBody = firstSuccess.responseBody;
			}
		}

		await db
			.update(incomingWebhooks)
			.set({
				processingStatus,
				responseStatus,
				responseBody,
			})
			.where(eq(incomingWebhooks.id, replayWebhookId));

		return c.json({
			message: `Webhook replayed successfully${endpointId ? ` to endpoint ${endpointId}` : ' to all endpoints'}`,
			replayWebhookId,
			endpointsCount: activeEndpoints.length,
			results: results.map((r) => ({
				endpointId: r.endpointId,
				success: r.success,
				statusCode: r.statusCode,
			})),
		});
	} catch (error) {
		console.error('Error replaying webhook:', error);
		return c.json({ error: 'Failed to replay webhook' }, 500);
	}
});

// Replay webhooks by date range with optional endpoint selection
app.post('/replay', async (c) => {
	try {
		const db = createDB(c.env.DB);
		const body = await c.req.json();
		const { startDate, endDate, endpointId } = body;

		if (!startDate || !endDate) {
			return c.json({ error: 'startDate and endDate are required' }, 400);
		}

		// Get webhooks in date range
		const webhooks = await db
			.select()
			.from(incomingWebhooks)
			.where(and(gte(incomingWebhooks.createdAt, startDate), lte(incomingWebhooks.createdAt, endDate)))
			.orderBy(desc(incomingWebhooks.createdAt));

		if (webhooks.length === 0) {
			return c.json({ message: 'No webhooks found in date range', count: 0 });
		}

		// Get endpoints based on selection
		let activeEndpoints;
		if (endpointId) {
			// Replay to specific endpoint
			activeEndpoints = await db
				.select()
				.from(endpoints)
				.where(and(eq(endpoints.id, endpointId), eq(endpoints.isActive, true)));

			if (activeEndpoints.length === 0) {
				return c.json({ error: 'Endpoint not found or not active' }, 404);
			}
		} else {
			// Replay to all active endpoints
			activeEndpoints = await db.select().from(endpoints).where(eq(endpoints.isActive, true));

			if (activeEndpoints.length === 0) {
				return c.json({ error: 'No active endpoints configured' }, 500);
			}
		}

		let replayCount = 0;
		const replayResults = [];

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
					userAgent: `webhook-replay-batch${endpointId ? `-endpoint-${endpointId}` : ''}`,
					processingStatus: 'pending',
				});

				// Process webhook fanout
				const headers = webhook.headers ? JSON.parse(webhook.headers) : {};
				const results = await processWebhookFanout(db, replayWebhookId, webhook.method, headers, webhook.body || '', activeEndpoints);

				// Update processing status based on results
				const primaryResult = results.find((r) => r.isPrimary);
				let processingStatus = 'completed';
				let responseStatus: number | undefined;
				let responseBody: string | undefined;

				if (primaryResult) {
					processingStatus = primaryResult.success ? 'completed' : 'failed';
					responseStatus = primaryResult.statusCode;
					responseBody = primaryResult.responseBody;
				} else {
					processingStatus = results.some((r) => r.success) ? 'completed' : 'failed';
					// Use first successful result for response data if no primary
					const firstSuccess = results.find((r) => r.success);
					if (firstSuccess) {
						responseStatus = firstSuccess.statusCode;
						responseBody = firstSuccess.responseBody;
					}
				}

				await db
					.update(incomingWebhooks)
					.set({
						processingStatus,
						responseStatus,
						responseBody,
					})
					.where(eq(incomingWebhooks.id, replayWebhookId));

				replayResults.push({
					originalWebhookId: webhook.id,
					replayWebhookId,
					success: processingStatus === 'completed',
					endpointsCount: activeEndpoints.length,
				});

				replayCount++;
			} catch (error) {
				console.error(`Error replaying webhook ${webhook.id}:`, error);
				replayResults.push({
					originalWebhookId: webhook.id,
					replayWebhookId: null,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				// Continue with other webhooks
			}
		}

		return c.json({
			message: `Webhook batch replay completed${endpointId ? ` to endpoint ${endpointId}` : ' to all endpoints'}`,
			totalFound: webhooks.length,
			successfulReplays: replayCount,
			endpointsCount: activeEndpoints.length,
			results: replayResults,
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
			processingStatus: 'pending',
		});

		// Get all active endpoints
		const activeEndpoints = await db.select().from(endpoints).where(eq(endpoints.isActive, true));

		if (activeEndpoints.length === 0) {
			// Update processing status to failed
			await db.update(incomingWebhooks).set({ processingStatus: 'failed' }).where(eq(incomingWebhooks.id, webhookId));

			return c.json({ error: 'No active endpoints configured' }, 500);
		}

		// Process webhooks
		const results = await processWebhookFanout(db, webhookId, method, headers, body, activeEndpoints);

		// Determine processing status based on primary endpoint result
		const primaryResult = results.find((r) => r.isPrimary);
		let processingStatus = 'completed';
		let responseStatus: number | undefined;
		let responseBody: string | undefined;

		if (primaryResult) {
			processingStatus = primaryResult.success ? 'completed' : 'failed';
			responseStatus = primaryResult.statusCode;
			responseBody = primaryResult.responseBody;
		} else {
			// No primary endpoint, check if any endpoint succeeded
			processingStatus = results.some((r) => r.success) ? 'completed' : 'failed';
			// Use first successful result for response data if no primary
			const firstSuccess = results.find((r) => r.success);
			if (firstSuccess) {
				responseStatus = firstSuccess.statusCode;
				responseBody = firstSuccess.responseBody;
			}
		}

		// Update processing status and response data
		await db
			.update(incomingWebhooks)
			.set({
				processingStatus,
				responseStatus,
				responseBody,
			})
			.where(eq(incomingWebhooks.id, webhookId));

		// Return primary endpoint response or fallback
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

		// Try to update processing status to failed if webhookId exists
		try {
			const db = createDB(c.env.DB);
			// We need to find the webhook ID - create a simple UUID for error case
			const errorWebhookId = crypto.randomUUID();
			await db.insert(incomingWebhooks).values({
				id: errorWebhookId,
				method: c.req.method,
				headers: JSON.stringify(Object.fromEntries(c.req.raw.headers)),
				body: 'Error processing webhook',
				sourceIp: c.req.header('cf-connecting-ip') || 'unknown',
				userAgent: c.req.header('user-agent') || 'unknown',
				processingStatus: 'failed',
			});
		} catch (dbError) {
			console.error('Failed to log error webhook:', dbError);
		}

		return c.json({ error: 'Internal server error' }, 500);
	}
}

async function processWebhookFanout(db: any, webhookId: string, method: string, incomingHeaders: any, body: string, endpointList: any[]) {
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
