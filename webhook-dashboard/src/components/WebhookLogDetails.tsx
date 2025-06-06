import React, { useState } from 'react';
import { WebhookLog, Endpoint } from '@/types/webhook';
import { formatHeaders, formatBangkokTime } from '@/lib/utils';

interface Props {
  log: WebhookLog;
  showUrl?: boolean;
  onReplay?: (webhookId: string, endpointId?: number) => void;
  isSelected?: boolean;
  onSelect?: (isSelected: boolean) => void;
  endpoints?: Endpoint[];
  isReplaying?: boolean;
}

export function WebhookLogDetails({ log, onReplay, showUrl, endpoints = [], isReplaying = false }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const tryParseJSON = (str: string): object | string => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const headers: Record<string, string> = formatHeaders(log.headers);
  const body = log.body ? tryParseJSON(log.body) : null;
  const responseBody = log.responseBody ? tryParseJSON(log.responseBody) : null;

  return (
    <>
      {/* Summary row */}
      <tr 
        onClick={() => setExpanded(!expanded)}
        className="hover:bg-gray-50 cursor-pointer"
      >
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
          {log.id}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 font-mono">
          {log.webhookId || 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            log.direction === 'outgoing' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {log.direction}
          </span>
        </td>
        {showUrl && log.endpointUrl && (
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <a 
              href={log.endpointUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline"
            >
              {log.endpointUrl}
            </a>
          </td>
        )}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {log.method}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            (log.statusCode || 503) >= 400 
              ? 'bg-red-100 text-red-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {log.statusCode || 'Timeout'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatBangkokTime(log.createdAt)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onReplay && log.webhookId) {
                  onReplay(log.webhookId,endpoints.find(ep=> ep.url === log.endpointUrl)?.id);
                }
              }}
              disabled={isReplaying}
              className={`inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white ${
                isReplaying 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
            >
              {isReplaying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Replaying...
                </>
              ) : (
                'Replay'
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {expanded ? (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="space-y-6">
              {/* Headers */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Headers:</h4>
                <pre className="bg-gray-100 text-gray-800 p-4 rounded-md overflow-auto max-h-48 text-sm">
                  {JSON.stringify(headers, null, 2)}
                </pre>
              </div>

              {/* Request Body */}
              {body && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Request Body:</h4>
                  <pre className="bg-gray-100 text-gray-800 p-4 rounded-md overflow-auto max-h-48 text-sm">
                    {JSON.stringify(body, null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Details */}
              {log.direction === 'outgoing' && (
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h4 className="text-sm font-medium text-gray-900">Response:</h4>
                    {log.responseTime && (
                      <span className="text-xs text-gray-500">
                        Response Time: {log.responseTime}ms
                      </span>
                    )}
                  </div>
                  <pre className="bg-gray-100 text-gray-800 p-4 rounded-md overflow-auto max-h-48 text-sm">
                    {JSON.stringify(responseBody, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
