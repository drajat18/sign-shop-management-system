import { useSearchParams } from "react-router-dom";

// Landing page after a real Square/PayPal checkout — the backend already
// confirmed (or failed to confirm) the payment server-side before
// redirecting here, this just reports the outcome.
export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("status") === "success";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
        </div>
        <h1 className="auth-title">{success ? "Payment received" : "Payment not completed"}</h1>
        <p className="cell-muted" style={{ fontSize: 14 }}>
          {success
            ? "Thank you! The shop has been notified and your order will be updated shortly."
            : "We couldn't confirm this payment. Please contact the shop if you believe this is a mistake."}
        </p>
      </div>
    </div>
  );
}
