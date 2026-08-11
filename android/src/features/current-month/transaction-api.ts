import {
  type Transaction,
  type TransactionCreate,
  transactionCreateSchema,
  transactionResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * The create schema goes along as the request schema, so a payload the server
 * would refuse is refused here first — with the same message, and without a
 * round trip.
 */
export function createTransaction(
  payload: TransactionCreate,
): Promise<Transaction> {
  return api
    .post<
      { data: Transaction },
      TransactionCreate
    >(ENDPOINTS.transactions, payload, transactionResponseSchema, transactionCreateSchema)
    .then((response) => response.data);
}
