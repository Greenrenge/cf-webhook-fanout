import { Endpoint, WebhookLog } from '@/types/webhook';

const WORKER_API_URL = process.env.NEXT_PUBLIC_WORKER_API_URL || 'http://localhost:8787';

export class WebhookAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = WORKER_API_URL;
  }

  async getEndpoints(): Promise<Endpoint[]> {
    try {
      const response = await fetch(`${this.baseUrl}/config/endpoints`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoints: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.endpoints;
    } catch (error) {
      throw error;
    }
  }

  async createEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint> {
    const response = await fetch(`${this.baseUrl}/config/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpoint),
    });
    if (!response.ok) {
      throw new Error('Failed to create endpoint');
    }
    const data = await response.json();
    return data.endpoint;
  }

  async deleteEndpoint(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/config/endpoints/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete endpoint');
    }
  }

  async updateEndpoint(id: number, updates: Partial<Endpoint>): Promise<Endpoint> {
    const response = await fetch(`${this.baseUrl}/config/endpoints/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update endpoint');
    }
    const data = await response.json();
    return data.endpoint;
  }

  async getWebhookLogs(limit = 100): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch webhook logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async getEndpointLogs(endpointUrl: string): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?endpoint=${encodeURIComponent(endpointUrl)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch endpoint logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async getWebhookLogsByEndpoint(endpointId: number): Promise<WebhookLog[]> {
    const response = await fetch(`${this.baseUrl}/logs?endpointId=${endpointId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch endpoint logs');
    }
    const data = await response.json();
    return data.logs;
  }

  async replayWebhookById(webhookId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/replay/${webhookId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to replay webhook');
    }
  }

  async replayWebhooksByDateRange(startDate: string, endDate: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to replay webhooks');
    }
  }

  async getWebhooks(): Promise<Array<{ id: string; url: string; method: string; createdAt: string }>> {
    const response = await fetch(`${this.baseUrl}/webhooks`);
    if (!response.ok) {
      throw new Error('Failed to fetch webhooks');
    }
    const data = await response.json();
    return data.webhooks;
  }
}

export const webhookAPI = new WebhookAPI();
