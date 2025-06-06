export interface Endpoint {
  id: number;
  url: string;
  isPrimary: boolean;
  headers: string;
  tenantId?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookLog {
  id: number;
  webhookId: string;
  direction: 'incoming' | 'outgoing';
  endpointUrl?: string;
  method: string;
  headers: string;
  body?: string;
  statusCode?: number;
  responseBody?: string;
  responseTime?: number;
  tenantId?: string;
  createdAt: number;
}

export interface IncomingWebhook {
  id: string;
  method: string;
  headers: string;
  body?: string;
  tenantId?: string;
  sourceIp: string;
  userAgent: string;
  processingStatus: 'pending' | 'completed' | 'failed';
  createdAt: number;
}
