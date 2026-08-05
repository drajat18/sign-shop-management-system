import { apiFetch } from "./client.js";
import type { MaterialCostEstimate } from "../types/index.js";

export async function estimateMaterialCost(
  input: { material: string; size?: string; quantity: number },
  token: string | null
): Promise<MaterialCostEstimate> {
  return apiFetch<MaterialCostEstimate>("/material-cost/estimate", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}
