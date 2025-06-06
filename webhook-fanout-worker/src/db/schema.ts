import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Endpoints table - stores webhook endpoints configuration
export const endpoints = sqliteTable('endpoints', {
	id: integer('id').primaryKey(),
	url: text('url').notNull(),
	isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
	headers: text('headers'), // JSON string of custom headers
	tenantId: text('tenant_id'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

// Webhook logs table - stores all webhook activity
export const webhookLogs = sqliteTable('webhook_logs', {
	id: integer('id').primaryKey(),
	webhookId: text('webhook_id').notNull(), // UUID for grouping related logs
	direction: text('direction').notNull(), // 'incoming' | 'outgoing'
	endpointUrl: text('endpoint_url'),
	method: text('method').notNull(),
	headers: text('headers'), // JSON string
	body: text('body'),
	statusCode: integer('status_code'),
	responseBody: text('response_body'),
	responseTime: integer('response_time'), // milliseconds
	tenantId: text('tenant_id'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

// Incoming webhooks table - stores received webhook metadata
export const incomingWebhooks = sqliteTable('incoming_webhooks', {
	id: text('id').primaryKey(), // UUID
	method: text('method').notNull(),
	headers: text('headers'), // JSON string
	body: text('body'),
	tenantId: text('tenant_id'),
	sourceIp: text('source_ip'),
	userAgent: text('user_agent'),
	processingStatus: text('processing_status').notNull().default('pending'), // 'pending' | 'completed' | 'failed'
	responseStatus: integer('response_status'), // HTTP status code
	responseBody: text('response_body'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

export type Endpoint = typeof endpoints.$inferSelect;
export type NewEndpoint = typeof endpoints.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type IncomingWebhook = typeof incomingWebhooks.$inferSelect;
export type NewIncomingWebhook = typeof incomingWebhooks.$inferInsert;
