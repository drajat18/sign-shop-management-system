import { useState } from "react";

// Shop-level Dropbox connection status + employee management live here.
// Design doc: "Settings shows connected/disconnected status clearly to
// avoid silent failures."
export default function SettingsPage() {
  const [dropboxConnected] = useState(false);

  return (
    <div>
      <h1>Settings</h1>
      <section>
        <h2>File storage</h2>
        <p>Dropbox: {dropboxConnected ? "Connected" : "Not connected"}</p>
        <button type="button">{dropboxConnected ? "Disconnect" : "Connect Dropbox"}</button>
      </section>
    </div>
  );
}
