import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { usePlan } from "../auth/PlanContext.js";
import { NAV_ITEMS, ROLE_LABEL } from "../auth/roles.js";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const plan = usePlan();
  const navigate = useNavigate();

  if (!user) return null;

  // Reports is Growth+ — held back until the plan loads rather than
  // flashing the link and then yanking it away a moment later.
  const links = NAV_ITEMS.filter((item) => item.roles.includes(user.role)).filter(
    (item) => item.to !== "/reports" || plan?.features.reports === true
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span className="brand-name">Sign Shop</span>
        </div>
        <nav className="nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "nav-link" + (isActive ? " nav-link-active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
