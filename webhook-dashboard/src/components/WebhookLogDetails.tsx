import { useState } from 'react';
import { WebhookLog } from '@/types/webhook';
import { tryParseJSON, formatHeaders, prettyPrintJSON, formatBangkokTime } from '@/lib/utils';

interface Props {
  log: WebhookLog;
  onReplay?: (webhookId: string) => void;
}

export function WebhookLogDetails({ log, onReplay }: Props) {
  const [expanded, setExpanded] = useState(false);

  const headers = formatHeaders(log.headers);
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
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {log.endpointUrl || 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {log.method}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            (log.statusCode || 0) >= 400
              ? 'bg-red-100 text-red-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {log.statusCode || 'N/A'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatBangkokTime(log.createdAt)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          {log.direction === 'incoming' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('Replaying webhook:', log.webhookId);
                if (onReplay && log.webhookId) {
                  onReplay(log.webhookId);
                } else {
                  console.log('Missing onReplay or webhookId');
                }
              }}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Replay
            </button>
          ) : (
            <span className="text-xs text-gray-400">
              -
            </span>
          )}
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-6">
              {/* Headers */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Headers:</h4>
                <pre className="bg-gray-100 text-gray-800 p-4 rounded-md overflow-auto max-h-48 text-sm">
                  {prettyPrintJSON(headers) as string}
                </pre>
              </div>

              {/* Request Body */}
              {body && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Request Body:</h4>
                  <pre className="bg-gray-100 text-gray-800 p-4 rounded-md overflow-auto max-h-48 text-sm">
                    {String(prettyPrintJSON(body))}
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
                    {String(prettyPrintJSON(responseBody))}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
