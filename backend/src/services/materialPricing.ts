// Stand-in for real vendor pricing feeds — no sign-material distributor
// (Grimco, Coastal Business Supplies, etc.) publishes a self-serve pricing
// API, so this simulates "checking a few vendors" the same way the dummy
// billing/payment providers stand in elsewhere in this app. Swap in a real
// vendor's API here once one is actually available.
const DUMMY_VENDORS = ["Grimco", "Coastal Business Supplies", "3M Supply"];

const BASE_RATE_PER_SQFT: Record<string, number> = {
  "aluminum composite": 6.5,
  aluminum: 6.5,
  acm: 6.5,
  acrylic: 8,
  plexiglass: 8,
  sintra: 4.5,
  pvc: 4.5,
  vinyl: 2.25,
  coroplast: 2,
  corrugated: 2,
  "foam board": 3,
  foamboard: 3,
  plywood: 5,
  wood: 5,
  banner: 1.75,
  steel: 7.5,
  metal: 6,
  led: 12,
};

const DEFAULT_RATE_PER_SQFT = 5;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function baseRateForMaterial(material: string): number {
  const key = material.trim().toLowerCase();
  for (const [name, rate] of Object.entries(BASE_RATE_PER_SQFT)) {
    if (key.includes(name)) return rate;
  }
  return DEFAULT_RATE_PER_SQFT;
}

// Accepts "24x36", "24"x36"", "24 x 36", etc. — falls back to a flat 1 sqft
// (i.e. a per-piece rate) when the size can't be parsed as two dimensions.
function parseAreaSqft(size?: string): number {
  if (!size) return 1;
  const match = size.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
  if (!match) return 1;
  const areaSqIn = Number(match[1]) * Number(match[2]);
  return Math.max(areaSqIn / 144, 0.25);
}

export interface MaterialVendorQuote {
  vendor: string;
  costPerUnit: number;
}

export interface MaterialCostEstimate {
  material: string;
  costPerUnit: number;
  totalCost: number;
  bestVendor: string;
  quotes: MaterialVendorQuote[];
}

export function estimateMaterialCost({
  material,
  size,
  quantity,
}: {
  material: string;
  size?: string;
  quantity: number;
}): MaterialCostEstimate {
  const baseCostPerUnit = baseRateForMaterial(material) * parseAreaSqft(size);

  // Seeded off material+vendor (not pure Math.random) so the same material
  // quotes consistently across repeated lookups, rather than jumping around
  // on every click.
  const quotes: MaterialVendorQuote[] = DUMMY_VENDORS.map((vendor) => {
    const seed = hashString(`${material.toLowerCase()}:${vendor}`);
    const variance = 0.85 + (seed % 31) / 100; // ~0.85x - 1.15x
    return { vendor, costPerUnit: Math.round(baseCostPerUnit * variance * 100) / 100 };
  });

  const best = quotes.reduce((min, q) => (q.costPerUnit < min.costPerUnit ? q : min));

  return {
    material,
    costPerUnit: best.costPerUnit,
    totalCost: Math.round(best.costPerUnit * quantity * 100) / 100,
    bestVendor: best.vendor,
    quotes,
  };
}
