import { Endpoint, WebhookLog, IncomingWebhook } from '@/types/webhook';
import { convertBangkokDateToTimestamp } from './utils';

const WORKER_API_URL = process.env.NEXT_PUBLIC_WORKER_API_URL || 'http://localhost:8787';

export class WebhookAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = WORKER_API_URL;
  }

  private getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async getEndpoints(token?: string): Promise<Endpoint[]> {
    try {
      const response = await fetch(`${this.baseUrl}/config/endpoints`, {
        headers: this.getAuthHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoints: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.endpoints;
    } catch (error) {
      throw error;
    }
  }

  async createEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>, token?: string): Promise<Endpoint> {
    const response = await fetch(`${this.baseUrl}/config/endpoints`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(endpoint),
    });
    if (!response.ok) {
      throw new Error('Failed to create endpoint');
    }
    const data = await response.json();
    return data.endpoint;
  }

  async deleteEndpoint(id: number, token?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/config/endpoints/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to delete endpoint');
    }
  }

  async updateEndpoint(id: number, updates: Partial<Endpoint>, token?: string): Promise<Endpoint> {
    const response = await fetch(`${this.baseUrl}/config/endpoints/${id}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update endpoint');
    }
    const data = await response.json();
    return data.endpoint;
  }

  async getWebhookLogs(limit = 100, skip = 0, token?: string): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?limit=${limit}&skip=${skip}`, {
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch webhook logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async getIncomingWebhooks(limit = 100, skip = 0, token?: string): Promise<IncomingWebhook[]> {
    const response = await fetch(`${this.baseUrl}/webhooks?limit=${limit}&skip=${skip}`, {
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch incoming webhooks');
    }
    const data = await response.json();
    return data.webhooks;
  }

  async clearWebhookLogs(token?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/logs`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to clear webhook logs');
    }
  }

  async clearIncomingWebhooks(token?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/webhooks`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to clear incoming webhooks');
    }
  }

  async getEndpointLogs(endpointUrl: string, token?: string): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?endpoint=${encodeURIComponent(endpointUrl)}`, {
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch endpoint logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async getWebhookLogsByEndpoint(endpointId: number, token?: string): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?endpointId=${endpointId}`, {
      headers: this.getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch endpoint logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async replayWebhookById(webhookId: string, endpointId?: number, token?: string): Promise<void> {
    const body = endpointId ? { endpointId } : {};
    const response = await fetch(`${this.baseUrl}/replay/${webhookId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error('Failed to replay webhook');
    }
  }

  async replayWebhooksByDateRange(startDate: string, endDate: string, endpointId?: number, token?: string): Promise<void> {
    const body: { startDate: number; endDate: number; endpointId?: number } = {
      startDate: convertBangkokDateToTimestamp(startDate),
      endDate: convertBangkokDateToTimestamp(endDate),
    };
    if (endpointId) {
      body.endpointId = endpointId;
    }
    
    const response = await fetch(`${this.baseUrl}/replay`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error('Failed to replay webhooks');
    }
  }
}

export const webhookAPI = new WebhookAPI();
