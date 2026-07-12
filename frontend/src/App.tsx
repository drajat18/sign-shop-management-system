import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import SettingsPage from "./pages/admin/SettingsPage.js";
import OrdersPage from "./pages/front-desk/OrdersPage.js";
import Login from "./pages/Login.js";
import JobsPage from "./pages/production/JobsPage.js";

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/orders" element={user ? <OrdersPage /> : <Navigate to="/login" />} />
      <Route path="/jobs" element={user ? <JobsPage /> : <Navigate to="/login" />} />
      <Route path="/admin" element={user?.role === "admin" ? <SettingsPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
