import { apiFetch } from "./client.js";
import type { OrderMessage } from "../types/index.js";

export async function listOrderMessages(orderId: string, token: string | null): Promise<OrderMessage[]> {
  return apiFetch<OrderMessage[]>(`/orders/${orderId}/messages`, { token });
}

export async function sendOrderMessage(
  orderId: string,
  body: string,
  token: string | null
): Promise<OrderMessage> {
  return apiFetch<OrderMessage>(`/orders/${orderId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
}
