import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.js";
import PlatformLayout from "./components/PlatformLayout.js";
import { useAuth } from "./auth/AuthContext.js";
import { usePlan } from "./auth/PlanContext.js";
import { usePlatformAuth } from "./auth/PlatformAuthContext.js";
import { PAGE_ACCESS, ROLE_LANDING_PAGE, canAccess } from "./auth/roles.js";
import EmployeesPage from "./pages/admin/EmployeesPage.js";
import ReportsPage from "./pages/admin/ReportsPage.js";
import SettingsPage from "./pages/admin/SettingsPage.js";
import ForgotPassword from "./pages/ForgotPassword.js";
import OrdersPage from "./pages/front-desk/OrdersPage.js";
import Login from "./pages/Login.js";
import DummyChargePage from "./pages/payments/DummyChargePage.js";
import DummyConnectPage from "./pages/payments/DummyConnectPage.js";
import PaymentResultPage from "./pages/payments/PaymentResultPage.js";
import DummyCheckoutPage from "./pages/platform/DummyCheckoutPage.js";
import PlatformLogin from "./pages/platform/PlatformLogin.js";
import ShopsPage from "./pages/platform/ShopsPage.js";
import TeamPage from "./pages/platform/TeamPage.js";
import CustomerPortalPage from "./pages/portal/CustomerPortalPage.js";
import JobsPage from "./pages/production/JobsPage.js";
import ScanJobPage from "./pages/production/ScanJobPage.js";
import ResetPassword from "./pages/ResetPassword.js";
import type { Role } from "./types/index.js";

function guarded(role: Role, allowed: Role[], element: ReactElement, landing: string) {
  return canAccess(role, allowed) ? element : <Navigate to={landing} replace />;
}

export default function App() {
  const { user } = useAuth();
  const plan = usePlan();
  const { user: platformUser } = usePlatformAuth();

  // Fully public, no auth of any kind — a customer's link is the only
  // credential. Needs to work whether or not this browser also happens to
  // have an employee or platform session active.
  const publicRoutes = (
    <>
      <Route path="/portal/:shopId/:token" element={<CustomerPortalPage />} />
      <Route path="/billing/dummy-checkout/:token" element={<DummyCheckoutPage />} />
      <Route path="/payments/dummy-connect/:token" element={<DummyConnectPage />} />
      <Route path="/payments/dummy-charge/:token" element={<DummyChargePage />} />
      <Route path="/payments/result" element={<PaymentResultPage />} />
    </>
  );

  // The platform console lives at /platform/* independent of any shop
  // session — a platform team member doesn't need to be (and usually
  // isn't) logged into a shop at all.
  const platformRoutes = (
    <>
      <Route
        path="/platform/login"
        element={platformUser ? <Navigate to="/platform/shops" replace /> : <PlatformLogin />}
      />
      <Route element={platformUser ? <PlatformLayout /> : <Navigate to="/platform/login" replace />}>
        <Route path="/platform/shops" element={<ShopsPage />} />
        <Route
          path="/platform/team"
          element={platformUser?.role === "owner" ? <TeamPage /> : <Navigate to="/platform/shops" replace />}
        />
      </Route>
    </>
  );

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {publicRoutes}
        {platformRoutes}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const landing = ROLE_LANDING_PAGE[user.role];

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={landing} replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {publicRoutes}
      {platformRoutes}
      <Route
        path="/scan/job/:jobId"
        element={guarded(user.role, PAGE_ACCESS.jobs, <ScanJobPage />, landing)}
      />
      <Route element={<AppLayout />}>
        <Route path="/orders" element={guarded(user.role, PAGE_ACCESS.orders, <OrdersPage />, landing)} />
        <Route path="/jobs" element={guarded(user.role, PAGE_ACCESS.jobs, <JobsPage />, landing)} />
        <Route path="/employees" element={guarded(user.role, PAGE_ACCESS.employees, <EmployeesPage />, landing)} />
        <Route
          path="/reports"
          element={
            plan && !plan.features.reports
              ? <Navigate to={landing} replace />
              : guarded(user.role, PAGE_ACCESS.reports, <ReportsPage />, landing)
          }
        />
        <Route path="/admin" element={guarded(user.role, PAGE_ACCESS.settings, <SettingsPage />, landing)} />
      </Route>
      <Route path="*" element={<Navigate to={landing} replace />} />
    </Routes>
  );
}
