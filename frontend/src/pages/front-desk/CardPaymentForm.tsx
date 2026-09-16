import { useEffect, useRef, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  completeDummyCardPayment,
  confirmCardPaymentIntent,
  createCardPaymentIntent,
  type CardPaymentIntentResponse,
} from "../../api/cardPayments.js";

// One Stripe.js instance per (publishable key, connected account) pair —
// loadStripe() fetches an external script, so this avoids re-loading it on
// every render or every time this form remounts for a new charge.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(publishableKey: string, connectedAccountId: string): Promise<Stripe | null> {
  const key = `${publishableKey}:${connectedAccountId}`;
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(publishableKey, { stripeAccount: connectedAccountId });
    stripePromiseCache.set(key, cached);
  }
  return cached;
}

function StripeCardFields({
  orderId,
  amount,
  clientSecret,
  token,
  onSuccess,
  onCancel,
}: {
  orderId: string;
  amount: number;
  clientSecret: string;
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCharge() {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "The card was declined.");
      }
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error(`Payment didn't complete (status: ${result.paymentIntent?.status ?? "unknown"}).`);
      }
      // The card is charged at this point — record it on our own ledger so
      // it shows up as paid. If this call fails, the money's still real;
      // staff can retry recording it without re-charging the card, since
      // the backend confirm step is idempotent on the PaymentIntent id.
      await confirmCardPaymentIntent(orderId, result.paymentIntent.id, token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to charge card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="item-card" style={{ marginTop: 8 }}>
      <label className="field">
        Card details
        <div
          style={{
            padding: "10px 12px",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            background: "var(--color-surface)",
          }}
        >
          <CardElement options={{ style: { base: { fontSize: "15px" } } }} />
        </div>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleCharge} disabled={busy || !stripe}>
          {busy ? "Charging…" : `Charge $${amount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

export default function CardPaymentForm({
  orderId,
  amount,
  token,
  onSuccess,
  onCancel,
}: {
  orderId: string;
  amount: number;
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [intent, setIntent] = useState<CardPaymentIntentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dummyBusy, setDummyBusy] = useState(false);
  const [dummyError, setDummyError] = useState<string | null>(null);

  useEffect(() => {
    createCardPaymentIntent(orderId, amount, token)
      .then(setIntent)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to start card charge"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guards against a double-click firing this twice before React re-renders
  // the disabled button — state updates are async, a ref read is not. The
  // backend is idempotent on attemptId regardless, but there's no reason to
  // fire the second request at all.
  const dummyChargeInFlight = useRef(false);

  async function handleDummyCharge() {
    if (dummyChargeInFlight.current || intent?.mode !== "dummy") return;
    dummyChargeInFlight.current = true;
    setDummyBusy(true);
    setDummyError(null);
    try {
      await completeDummyCardPayment(orderId, amount, intent.attemptId, token);
      onSuccess();
    } catch (err) {
      setDummyError(err instanceof Error ? err.message : "Failed to charge test card");
    } finally {
      dummyChargeInFlight.current = false;
      setDummyBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="item-card" style={{ marginTop: 8 }}>
        <p className="form-error">{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  if (!intent) {
    return (
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 8 }}>
        Preparing card form…
      </p>
    );
  }

  if (intent.mode === "dummy") {
    return (
      <div className="item-card" style={{ marginTop: 8 }}>
        <p className="cell-muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
          Test mode — connect a real Stripe account in Settings to actually charge cards. Confirming
          here just records a test payment, no card is charged.
        </p>
        {dummyError && <p className="form-error">{dummyError}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={dummyBusy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleDummyCharge} disabled={dummyBusy}>
            {dummyBusy ? "Charging…" : `Charge $${amount.toFixed(2)} (test)`}
          </button>
        </div>
      </div>
    );
  }

  if (!intent.publishableKey) {
    return (
      <div className="item-card" style={{ marginTop: 8 }}>
        <p className="form-error">
          Stripe is connected, but the server doesn't have a publishable key configured
          (STRIPE_PUBLISHABLE_KEY).
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={getStripePromise(intent.publishableKey, intent.connectedAccountId)}>
      <StripeCardFields
        orderId={orderId}
        amount={amount}
        clientSecret={intent.clientSecret}
        token={token}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
