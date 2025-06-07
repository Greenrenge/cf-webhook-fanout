'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Endpoint, WebhookLog, IncomingWebhook } from '@/types/webhook';
import { WebhookAPI } from '@/lib/api';
import { WebhookLogDetails } from '@/components/WebhookLogDetails';
import { formatBangkokDate } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

export default function Dashboard() {
  const { addToast } = useToast();
  const { data: session, status } = useSession();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [incomingWebhooks, setIncomingWebhooks] = useState<IncomingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showEndpointLogs, setShowEndpointLogs] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [endpointLogs, setEndpointLogs] = useState<WebhookLog[]>([]);
  const [replayingWebhooks, setReplayingWebhooks] = useState<Set<string>>(new Set());
  const [replayingIncomingWebhooks, setReplayingIncomingWebhooks] = useState<Set<string>>(new Set());
  const [selectedIncomingWebhook, setSelectedIncomingWebhook] = useState<IncomingWebhook | null>(null);
  const [showIncomingWebhookDetails, setShowIncomingWebhookDetails] = useState(false);
  
  // Pagination state
  const [webhookLogsPage, setWebhookLogsPage] = useState(0);
  const [incomingWebhooksPage, setIncomingWebhooksPage] = useState(0);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [clearingWebhooks, setClearingWebhooks] = useState(false);
  const ITEMS_PER_PAGE = 30;

  const api = useMemo(() => new WebhookAPI(), []);
  const handleReplayIncomingWebhook = useCallback((webhookId: string) => {
    setReplayingIncomingWebhooks(prev => new Set(prev).add(webhookId));
  }, []);

  const loadWebhookLogs = useCallback(async (page = 0) => {
    try {
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      const logsData = await api.getWebhookLogs(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE, token);
      setWebhookLogs(logsData);
    } catch (error) {
      console.error('Failed to load webhook logs:', error);
      setWebhookLogs([]);
    }
  }, [api, ITEMS_PER_PAGE, session]);

  const loadIncomingWebhooks = useCallback(async (page = 0) => {
    try {
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      const webhooksData = await api.getIncomingWebhooks(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE, token);
      setIncomingWebhooks(webhooksData);
    } catch (error) {
      console.error('Failed to load incoming webhooks:', error);
      setIncomingWebhooks([]);
    }
  }, [api, ITEMS_PER_PAGE, session]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      const [endpointsData] = await Promise.all([
        api.getEndpoints(token),
        loadWebhookLogs(webhookLogsPage),
        loadIncomingWebhooks(incomingWebhooksPage)
      ]);
      setEndpoints(endpointsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      // Show empty state when API is unavailable
      setEndpoints([]);
      setWebhookLogs([]);
      setIncomingWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, [api, loadWebhookLogs, loadIncomingWebhooks, webhookLogsPage, incomingWebhooksPage, session]);

  useEffect(() => {
    // Auto-load data since we're simulating a logged-in user
    loadData();
  }, [loadData]);

  const handleEndpointClick = async (endpoint: Endpoint) => {
    try {
      setSelectedEndpoint(endpoint);
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      const logs = await api.getWebhookLogsByEndpoint(endpoint.id, token);
      setEndpointLogs(logs);
      setShowEndpointLogs(true);
    } catch (error) {
      console.error('Failed to load endpoint logs:', error);
    }
  };

  const togglePrimary = async (endpoint: Endpoint) => {
    try {
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      await api.updateEndpoint(endpoint.id, { isPrimary: !endpoint.isPrimary }, token);
      await loadData();
    } catch (error) {
      console.error('Failed to update endpoint:', error);
    }
  };

  const deleteEndpoint = async (id: number) => {
    if (confirm('Are you sure you want to delete this endpoint?')) {
      try {
        if (!session?.accessToken) {
          console.error('No access token available');
          return;
        }
        const token = session.accessToken;
        await api.deleteEndpoint(id, token);
        await loadData();
      } catch (error) {
        console.error('Failed to delete endpoint:', error);
      }
    }
  };

  const handleReplayWebhook = async (webhookId: string, endpointId?: number) => {
    try {
      setReplayingWebhooks(prev => new Set(prev).add(`${webhookId}_${endpointId || 'all'}`));
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      await api.replayWebhookById(webhookId, endpointId, token);
      addToast(`Webhook replayed successfully${endpointId ? ` to endpoint ${endpointId}` : ' to all endpoints'}`, 'success');
      await loadData(); // Refresh logs to show replay
    } catch (error) {
      console.error('Failed to replay webhook:', error);
      addToast('Failed to replay webhook', 'error');
    } finally {
      setReplayingWebhooks(prev => {
        const next = new Set(prev);
        next.delete(`${webhookId}_${endpointId || 'all'}`);
        return next;
      });
    }
  };

  const handleClearWebhookLogs = async () => {
    if (!confirm('Are you sure you want to clear all webhook logs? This action cannot be undone.')) return;
    
    try {
      setClearingLogs(true);
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      await api.clearWebhookLogs(token);
      setWebhookLogsPage(0);
      await loadWebhookLogs(0);
      addToast('Webhook logs cleared successfully', 'success');
    } catch (error) {
      console.error('Failed to clear webhook logs:', error);
      addToast('Failed to clear webhook logs', 'error');
    } finally {
      setClearingLogs(false);
    }
  };

  const handleClearIncomingWebhooks = async () => {
    if (!confirm('Are you sure you want to clear all incoming webhooks? This action cannot be undone.')) return;
    
    try {
      setClearingWebhooks(true);
      if (!session?.accessToken) {
        console.error('No access token available');
        return;
      }
      const token = session.accessToken;
      await api.clearIncomingWebhooks(token);
      setIncomingWebhooksPage(0);
      await loadIncomingWebhooks(0);
      addToast('Incoming webhooks cleared successfully', 'success');
    } catch (error) {
      console.error('Failed to clear incoming webhooks:', error);
      addToast('Failed to clear incoming webhooks', 'error');
    } finally {
      setClearingWebhooks(false);
    }
  };

  const handleWebhookLogsPageChange = async (newPage: number) => {
    setWebhookLogsPage(newPage);
    await loadWebhookLogs(newPage);
  };

  const handleIncomingWebhooksPageChange = async (newPage: number) => {
    setIncomingWebhooksPage(newPage);
    await loadIncomingWebhooks(newPage);
  };

  // Temporarily removing authentication check
  // if (status === 'loading') {
  //   return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  // }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
            Webhook Dashboard
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Please sign in to access the dashboard
          </p>
          <button
            onClick={() => signIn('keycloak')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign in with Keycloak
          </button>
        </div>
      </div>
    );
  }

  // Handle authentication errors (e.g., token refresh failures)
  if (session.error === 'RefreshAccessTokenError') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
            Session Expired
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Your session has expired. Please sign in again.
          </p>
          <button
            onClick={() => signIn('keycloak')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

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
                onClick={() => signOut()}
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
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
                  <h2 className="text-lg font-medium text-gray-900">Endpoints</h2>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3 mt-3 sm:mt-0 w-full sm:w-auto">
                    <button
                      onClick={() => setShowReplay(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors w-full sm:w-auto"
                    >
                      Replay Webhooks
                    </button>
                    <button
                      onClick={() => setShowAddEndpoint(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors w-full sm:w-auto"
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Primary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                          {endpoint.id}
                        </td>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                          {formatBangkokDate(endpoint.createdAt)}
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

            {/* Incoming Webhooks Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col items-start space-y-3 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
                  <h2 className="text-lg font-medium text-blue-800">Incoming Webhook Logs</h2>
                  <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                      onClick={handleClearIncomingWebhooks}
                      disabled={clearingWebhooks}
                      className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
                    >
                      {clearingWebhooks ? 'Clearing...' : 'Clear Webhooks'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        ID
                      </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Source IP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                        User Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incomingWebhooks.map((webhook) => (
                      <tr key={webhook.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                          {webhook.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800` }>
                                      incoming
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {webhook.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                          {webhook.sourceIp}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate hidden lg:table-cell">
                          {webhook.userAgent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            webhook.processingStatus === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : webhook.processingStatus === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {webhook.processingStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatBangkokDate(webhook.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplayWebhook(webhook.id);
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Replay
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIncomingWebhook(webhook);
                              setShowIncomingWebhookDetails(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              <div className="px-4 sm:px-6 py-4 flex justify-between items-center border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Page {incomingWebhooksPage + 1} • Showing {incomingWebhooks.length} items
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleIncomingWebhooksPageChange(incomingWebhooksPage - 1)}
                    disabled={incomingWebhooksPage === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleIncomingWebhooksPageChange(incomingWebhooksPage + 1)}
                    disabled={incomingWebhooks.length < ITEMS_PER_PAGE}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>



            {/* Webhook Logs Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col items-start space-y-3 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
                  <h2 className="text-lg font-medium text-green-800">Outgoing Webhook Logs</h2>
                  <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                      onClick={handleClearWebhookLogs}
                      disabled={clearingLogs}
                      className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
                    >
                      {clearingLogs ? 'Clearing...' : 'Clear Logs'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Webhook ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* ON PAGE */}
                    { webhookLogs.map((log) => (
                      <WebhookLogDetails 
                        showUrl
                        key={log.id} 
                        log={log} 
                        onReplay={handleReplayWebhook}
                        endpoints={endpoints}
                        isReplaying={log.webhookId ? replayingWebhooks.has(`${log.webhookId}_${endpoints.find(ep=>
                          ep.url === log.endpointUrl)?.id || 'all'}`
                        ) : false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              <div className="px-4 sm:px-6 py-4 flex justify-between items-center border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Page {webhookLogsPage + 1} • Showing {webhookLogs.length} items
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleWebhookLogsPageChange(webhookLogsPage - 1)}
                    disabled={webhookLogsPage === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleWebhookLogsPageChange(webhookLogsPage + 1)}
                    disabled={webhookLogs.length < ITEMS_PER_PAGE}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
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
        token={session?.accessToken || ''}
        addToast={addToast}
      />

      {/* Replay Modal */}
      <ReplayModal
        isOpen={showReplay}
        onClose={() => setShowReplay(false)}
        api={api}
        endpoints={endpoints}
        token={session?.accessToken || ''}
        addToast={addToast}
      />

      {/* Endpoint Logs Modal */}
      <EndpointLogsModal
        isOpen={showEndpointLogs}
        onClose={() => setShowEndpointLogs(false)}
        endpoint={selectedEndpoint}
        logs={endpointLogs}
        onReplay={handleReplayWebhook}
        endpoints={endpoints}
        replayingWebhooks={replayingWebhooks}
      />

      {/* Incoming Webhook Details Modal */}
      {selectedIncomingWebhook && (
        <IncomingWebhookDetailsModal
          isOpen={showIncomingWebhookDetails}
          onClose={() => setShowIncomingWebhookDetails(false)}
          webhook={selectedIncomingWebhook}
          onReplay={(webhookId) => {
            handleReplayIncomingWebhook(webhookId);
            handleReplayWebhook(webhookId)
          }}
          isReplaying={replayingIncomingWebhooks.has(selectedIncomingWebhook.id)}
        />
      )}
    </div>
  );
}

// Add Endpoint Modal Component
function AddEndpointModal({ isOpen, onClose, onSuccess, api, token }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  api: WebhookAPI;
  token?: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
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
      }, token);
      setUrl('');
      setHeaders('');
      setIsPrimary(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create endpoint:', error);
      addToast('Failed to create endpoint. Please check the details and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
              className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
function ReplayModal({ isOpen, onClose, api, endpoints, token }: {
  isOpen: boolean;
  onClose: () => void;
  api: WebhookAPI;
  endpoints: Endpoint[];
  token?: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [replayType, setReplayType] = useState<'id' | 'dateRange'>('id');
  const [webhookId, setWebhookId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  // const { addToast } = useToast(); // This was removed as ReplayModal should not call addToast directly

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (replayType === 'id') {
        await api.replayWebhookById(webhookId, selectedEndpoint, token);
      } else {
        await api.replayWebhooksByDateRange(startDate, endDate, selectedEndpoint, token);
      }
      addToast(`Replay initiated successfully${selectedEndpoint ? ` to endpoint ${selectedEndpoint}` : ' to all endpoints'}`, 'success');
      onClose();
    } catch (error) {
      console.error('Failed to replay webhook:', error);
      addToast('Failed to replay webhook. Please check the details and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter webhook ID"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date (Asia/Bangkok)
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Times are in Bangkok timezone (UTC+7)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Asia/Bangkok)
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Times are in Bangkok timezone (UTC+7)
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Endpoint (optional)
            </label>
            <select
              value={selectedEndpoint || ''}
              onChange={(e) => setSelectedEndpoint(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full border border-gray-300 text-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All active endpoints</option>
              {endpoints.map(endpoint => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.url} {endpoint.isPrimary ? '(Primary)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to replay to all active endpoints
            </p>
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
function EndpointLogsModal({ isOpen, onClose, endpoint, logs, onReplay, endpoints, replayingWebhooks }: {
  isOpen: boolean;
  onClose: () => void;
  endpoint: Endpoint | null;
  logs: WebhookLog[];
  onReplay: (webhookId: string, endpointId?: number) => void;
  endpoints: Endpoint[];
  replayingWebhooks: Set<string>;
}) {
  if (!isOpen || !endpoint) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Logs for {endpoint.id} : <pre className='inline break-words'>{endpoint.url}</pre>
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
                  Webhook ID
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* IN ENDPOINT */}
              {logs.map((log) => (
                <WebhookLogDetails 
                  key={log.id} 
                  log={log} 
                  onReplay={onReplay}
                  endpoints={endpoints}
                  isReplaying={log.webhookId ? replayingWebhooks.has(`${log.webhookId}_${endpoints.find(ep => ep.url === log.endpointUrl)?.id || 'all'}`) : false}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Incoming Webhook Details Modal Component
function IncomingWebhookDetailsModal({ isOpen, onClose, webhook, onReplay, isReplaying }: {
  isOpen: boolean;
  onClose: () => void;
  webhook: IncomingWebhook;
  onReplay: (webhookId: string, endpointId?: number) => void;
  isReplaying: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Incoming Webhook Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID
            </label>
            <div className="text-gray-900">
              {webhook.id}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Method
            </label>
            <div className="text-gray-900">
              {webhook.method}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source IP
            </label>
            <div className="text-gray-900">
              {webhook.sourceIp}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Agent
            </label>
            <div className="text-gray-900">
              {webhook.userAgent}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              webhook.processingStatus === 'completed'
                ? 'bg-green-100 text-green-800'
                : webhook.processingStatus === 'failed'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {webhook.processingStatus}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <div className="text-gray-900">
              {formatBangkokDate(webhook.createdAt)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => onReplay(webhook.id)}
            disabled={isReplaying}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isReplaying ? 'Replaying...' : 'Replay Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}