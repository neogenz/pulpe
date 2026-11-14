import {
  type McpActivity,
  type McpConnection,
  mcpActivityListResponseSchema,
  mcpConnectionListResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/** The most recent writes shown on a connection, as on iOS. */
const ACTIVITY_LIMIT = 50;

export function fetchConnections(): Promise<McpConnection[]> {
  return api
    .get(ENDPOINTS.mcpConnections, mcpConnectionListResponseSchema)
    .then((response) => response.data);
}

export function fetchConnectionActivity(id: string): Promise<McpActivity[]> {
  return api
    .get(ENDPOINTS.mcpConnectionActivity(id), mcpActivityListResponseSchema, {
      limit: ACTIVITY_LIMIT,
    })
    .then((response) => response.data);
}

/** Cuts the agent's access; it can only come back through a new authorization. */
export function revokeConnection(id: string): Promise<void> {
  return api.deleteVoid(ENDPOINTS.mcpConnection(id));
}
