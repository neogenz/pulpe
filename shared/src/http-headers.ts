/**
 * HTTP header constants shared between frontend and backend.
 *
 * REQUEST_ID_HEADER carries a correlation id for the request:
 * - Frontend generates a UUID per outgoing HTTP call and sends it.
 * - Backend reuses it for Pino logs and echoes it in the response and error envelope.
 * - PostHog events related to the request attach it as `request_id`.
 * - Non-FE callers (iOS, server-to-server, curl) that omit the header get a
 *   server-generated UUID instead.
 */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Lowercased variant for environments that normalize incoming headers
 * (Node.js `IncomingMessage.headers`, Express, etc.).
 */
export const REQUEST_ID_HEADER_LOWER = 'x-request-id';
