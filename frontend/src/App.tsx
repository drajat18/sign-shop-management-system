import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.js";
import { useAuth } from "./auth/AuthContext.js";
import { PAGE_ACCESS, ROLE_LANDING_PAGE, canAccess } from "./auth/roles.js";
import EmployeesPage from "./pages/admin/EmployeesPage.js";
import SettingsPage from "./pages/admin/SettingsPage.js";
import OrdersPage from "./pages/front-desk/OrdersPage.js";
import Login from "./pages/Login.js";
import JobsPage from "./pages/production/JobsPage.js";
import type { Role } from "./types/index.js";

function guarded(role: Role, allowed: Role[], element: ReactElement, landing: string) {
  return canAccess(role, allowed) ? element : <Navigate to={landing} replace />;
}

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const landing = ROLE_LANDING_PAGE[user.role];

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={landing} replace />} />
      <Route element={<AppLayout />}>
        <Route path="/orders" element={guarded(user.role, PAGE_ACCESS.orders, <OrdersPage />, landing)} />
        <Route path="/jobs" element={guarded(user.role, PAGE_ACCESS.jobs, <JobsPage />, landing)} />
        <Route path="/employees" element={guarded(user.role, PAGE_ACCESS.employees, <EmployeesPage />, landing)} />
        <Route path="/admin" element={guarded(user.role, PAGE_ACCESS.settings, <SettingsPage />, landing)} />
      </Route>
      <Route path="*" element={<Navigate to={landing} replace />} />
    </Routes>
  );
}
