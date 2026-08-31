import { apiFetch } from "./client.js";
import type { MaterialStock } from "../types/index.js";

export async function listMaterialStock(token: string | null): Promise<MaterialStock[]> {
  return apiFetch<MaterialStock[]>("/material-stock", { token });
}

export async function createMaterialStock(
  input: {
    materialName: string;
    unit: string;
    quantityOnHand: number;
    reorderThreshold: number;
    vendorName?: string;
    vendorContact?: string;
    leadTimeDays?: number;
  },
  token: string | null
): Promise<MaterialStock> {
  return apiFetch<MaterialStock>("/material-stock", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateMaterialStock(
  id: string,
  patch: Partial<
    Pick<
      MaterialStock,
      "materialName" | "unit" | "quantityOnHand" | "reorderThreshold" | "notes" | "vendorName" | "vendorContact" | "leadTimeDays"
    >
  >,
  token: string | null
): Promise<MaterialStock> {
  return apiFetch<MaterialStock>(`/material-stock/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(patch),
  });
}

export async function deleteMaterialStock(id: string, token: string | null): Promise<void> {
  await apiFetch(`/material-stock/${id}`, { method: "DELETE", token });
}
