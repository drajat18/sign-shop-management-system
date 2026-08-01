import { PAYPAL_BASE, getPaypalPlatformToken } from "../paymentOAuth/paypalConnect.js";

// Creates an Order payable to a specific connected merchant (payee.merchant_id)
// rather than the platform's own PayPal balance — this is what keeps the
// platform out of the money flow even though the API call itself is made
// with the platform's own credentials.
export async function createPaypalOrder(
  merchantId: string,
  amountUsd: number,
  returnUrl: string,
  cancelUrl: string
): Promise<string> {
  const token = await getPaypalPlatformToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
          payee: { merchant_id: merchantId },
        },
      ],
      application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" },
    }),
  });
  if (!res.ok) {
    throw new Error(`PayPal order creation failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { links?: { rel: string; href: string }[] };
  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href;
  if (!approveUrl) throw new Error("PayPal didn't return an approval link.");
  return approveUrl;
}

// Called from our own return_url once the customer approves on PayPal's
// side — capturing here (rather than trusting the redirect) is what
// actually moves the money and is the authoritative "did this succeed".
export async function capturePaypalOrder(orderId: string): Promise<boolean> {
  const token = await getPaypalPlatformToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { status?: string };
  return data.status === "COMPLETED";
}
