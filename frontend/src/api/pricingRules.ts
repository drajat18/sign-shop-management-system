import { apiFetch } from "./client.js";
import type { PricingMethod, PricingRule } from "../types/index.js";

export async function listPricingRules(token: string | null): Promise<PricingRule[]> {
  return apiFetch<PricingRule[]>("/pricing-rules", { token });
}

export interface PricingRuleInput {
  signType: string;
  method: PricingMethod;
  flatPrice?: number;
  pricePerSqft?: number;
  costPlusMarginPercent?: number;
  minPrice?: number;
}

export async function createPricingRule(input: PricingRuleInput, token: string | null): Promise<PricingRule> {
  return apiFetch<PricingRule>("/pricing-rules", { method: "POST", token, body: JSON.stringify(input) });
}

export async function updatePricingRule(
  id: string,
  patch: Partial<PricingRuleInput>,
  token: string | null
): Promise<PricingRule> {
  return apiFetch<PricingRule>(`/pricing-rules/${id}`, { method: "PATCH", token, body: JSON.stringify(patch) });
}

export async function deletePricingRule(id: string, token: string | null): Promise<void> {
  await apiFetch(`/pricing-rules/${id}`, { method: "DELETE", token });
}

// Client-side calculation, not a round trip — the rule list is small and
// already fetched, so there's no reason to ask the server to do arithmetic.
// Returns null when no rule matches or the inputs needed for that rule's
// method aren't available yet (e.g. a per_sqft rule with no dimensions).
export function calculatePriceFromRule(
  rule: PricingRule,
  input: { quantity: number; widthIn?: number; heightIn?: number; materialCostEstimate?: number }
): number | null {
  let unitPrice: number | null = null;
  if (rule.method === "flat" && typeof rule.flatPrice === "number") {
    unitPrice = rule.flatPrice;
  } else if (rule.method === "per_sqft" && typeof rule.pricePerSqft === "number") {
    if (!input.widthIn || !input.heightIn) return null;
    const sqft = (input.widthIn * input.heightIn) / 144;
    unitPrice = sqft * rule.pricePerSqft;
  } else if (rule.method === "cost_plus" && typeof rule.costPlusMarginPercent === "number") {
    if (typeof input.materialCostEstimate !== "number") return null;
    unitPrice = (input.materialCostEstimate / Math.max(1, input.quantity)) * (1 + rule.costPlusMarginPercent / 100);
  }
  if (unitPrice === null) return null;
  if (typeof rule.minPrice === "number") unitPrice = Math.max(unitPrice, rule.minPrice);
  return Math.round(unitPrice * 100) / 100;
}

export function findMatchingRule(rules: PricingRule[], signType: string): PricingRule | undefined {
  const key = signType.trim().toLowerCase();
  return rules.find((r) => r.signType.trim().toLowerCase() === key);
}
