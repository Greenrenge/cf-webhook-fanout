'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Endpoint, WebhookLog } from '@/types/webhook';
import { WebhookAPI } from '@/lib/api';

export default function Dashboard() {
  // For now, we'll simulate a logged-in user until we fix NextAuth
  const session = useMemo(() => ({ user: { name: 'Test User' } }), []);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showEndpointLogs, setShowEndpointLogs] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [endpointLogs, setEndpointLogs] = useState<WebhookLog[]>([]);

  const api = useMemo(() => new WebhookAPI(), []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [endpointsData, logsData] = await Promise.all([
        api.getEndpoints(),
        api.getWebhookLogs()
      ]);
      setEndpoints(endpointsData);
      setWebhookLogs(logsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // Auto-load data since we're simulating a logged-in user
    loadData();
  }, [loadData]);

  const handleEndpointClick = async (endpoint: Endpoint) => {
    try {
      setSelectedEndpoint(endpoint);
      const logs = await api.getWebhookLogsByEndpoint(endpoint.id);
      setEndpointLogs(logs);
      setShowEndpointLogs(true);
    } catch (error) {
      console.error('Failed to load endpoint logs:', error);
    }
  };

  const togglePrimary = async (endpoint: Endpoint) => {
    try {
      await api.updateEndpoint(endpoint.id, { isPrimary: !endpoint.isPrimary });
      await loadData();
    } catch (error) {
      console.error('Failed to update endpoint:', error);
    }
  };

  const deleteEndpoint = async (id: number) => {
    if (confirm('Are you sure you want to delete this endpoint?')) {
      try {
        await api.deleteEndpoint(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete endpoint:', error);
      }
    }
  };

  // Temporarily removing authentication check
  // if (status === 'loading') {
  //   return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  // }

  // if (!session) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-gray-50">
  //       <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
  //         <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
  //           Webhook Dashboard
  //         </h1>
  //         <p className="text-gray-600 text-center mb-8">
  //           Please sign in to access the dashboard
  //         </p>
  //         <button
  //           onClick={() => signIn('keycloak')}
  //           className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
  //         >
  //           Sign in with Keycloak
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Webhook Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {session.user?.name}</span>
              <button
                onClick={() => {/* TODO: implement sign out */}}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Endpoints Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Endpoints</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowReplay(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
                    >
                      Replay Webhooks
                    </button>
                    <button
                      onClick={() => setShowAddEndpoint(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
                    >
                      Add Endpoint
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Primary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {endpoints.map((endpoint) => (
                      <tr
                        key={endpoint.id}
                        onClick={() => handleEndpointClick(endpoint)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {endpoint.url}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            endpoint.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {endpoint.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            endpoint.isPrimary
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {endpoint.isPrimary ? 'Primary' : 'Secondary'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(endpoint.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePrimary(endpoint);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {endpoint.isPrimary ? 'Unmark Primary' : 'Mark Primary'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEndpoint(endpoint.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Webhook Logs Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Webhook Logs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endpoint
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {log.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.direction === 'incoming'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {log.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.endpointUrl || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.statusCode || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Endpoint Modal */}
      <AddEndpointModal
        isOpen={showAddEndpoint}
        onClose={() => setShowAddEndpoint(false)}
        onSuccess={() => {
          setShowAddEndpoint(false);
          loadData();
        }}
        api={api}
      />

      {/* Replay Modal */}
      <ReplayModal
        isOpen={showReplay}
        onClose={() => setShowReplay(false)}
        api={api}
      />

      {/* Endpoint Logs Modal */}
      <EndpointLogsModal
        isOpen={showEndpointLogs}
        onClose={() => setShowEndpointLogs(false)}
        endpoint={selectedEndpoint}
        logs={endpointLogs}
      />
    </div>
  );
}

// Add Endpoint Modal Component
function AddEndpointModal({ isOpen, onClose, onSuccess, api }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  api: WebhookAPI;
}) {
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.createEndpoint({
        url,
        headers,
        isPrimary,
        isActive: true,
      });
      setUrl('');
      setHeaders('');
      setIsPrimary(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create endpoint:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Endpoint</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/webhook"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Headers (JSON)
            </label>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder='{"Authorization": "Bearer token"}'
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="isPrimary" className="text-sm text-gray-700">
              Mark as primary endpoint
            </label>
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Replay Modal Component
function ReplayModal({ isOpen, onClose, api }: {
  isOpen: boolean;
  onClose: () => void;
  api: WebhookAPI;
}) {
  const [replayType, setReplayType] = useState<'id' | 'dateRange'>('id');
  const [webhookId, setWebhookId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (replayType === 'id') {
        await api.replayWebhookById(webhookId);
      } else {
        await api.replayWebhooksByDateRange(startDate, endDate);
      }
      alert('Replay initiated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to replay webhook:', error);
      alert('Failed to replay webhook');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Replay Webhooks</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Replay Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="id"
                  checked={replayType === 'id'}
                  onChange={(e) => setReplayType(e.target.value as 'id')}
                  className="mr-2"
                />
                By Webhook ID
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="dateRange"
                  checked={replayType === 'dateRange'}
                  onChange={(e) => setReplayType(e.target.value as 'dateRange')}
                  className="mr-2"
                />
                By Date Range
              </label>
            </div>
          </div>

          {replayType === 'id' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook ID
              </label>
              <input
                type="text"
                value={webhookId}
                onChange={(e) => setWebhookId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter webhook ID"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Replaying...' : 'Replay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Endpoint Logs Modal Component
function EndpointLogsModal({ isOpen, onClose, endpoint, logs }: {
  isOpen: boolean;
  onClose: () => void;
  endpoint: Endpoint | null;
  logs: WebhookLog[];
}) {
  if (!isOpen || !endpoint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Logs for {endpoint.url}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {log.id}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      log.direction === 'incoming'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {log.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {log.method}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {log.statusCode || '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}