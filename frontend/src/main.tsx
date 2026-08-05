import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { PlanProvider } from "./auth/PlanContext.js";
import { PlatformAuthProvider } from "./auth/PlatformAuthContext.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlanProvider>
          <PlatformAuthProvider>
            <App />
          </PlatformAuthProvider>
        </PlanProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
