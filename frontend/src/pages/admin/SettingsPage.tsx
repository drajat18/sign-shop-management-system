import { useState } from "react";

// Shop-level Dropbox connection status + employee management live here.
// Design doc: "Settings shows connected/disconnected status clearly to
// avoid silent failures."
export default function SettingsPage() {
  const [dropboxConnected] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Shop-wide configuration and integrations.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>File storage</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Connect Dropbox once for the whole shop; staff can then choose to save design files
          there instead of internal storage.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`badge ${dropboxConnected ? "badge-order-completed" : "badge-order-new"}`}>
            {dropboxConnected ? "Connected" : "Not connected"}
          </span>
          <button type="button" className="btn btn-primary">
            {dropboxConnected ? "Disconnect" : "Connect Dropbox"}
          </button>
        </div>
      </div>
    </div>
  );
}
