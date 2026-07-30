import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../auth/PlatformAuthContext.js";
import type { PlatformRole } from "../types/index.js";

const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  owner: "Owner",
  support: "Support",
  billing: "Billing",
  onboarding: "Onboarding",
};

const PLATFORM_NAV_ITEMS: { to: string; label: string; roles: PlatformRole[] }[] = [
  { to: "/platform/shops", label: "Shops", roles: ["owner", "support", "billing", "onboarding"] },
  { to: "/platform/team", label: "Team", roles: ["owner"] },
];

export default function PlatformLayout() {
  const { user, logout } = usePlatformAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const links = PLATFORM_NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  function handleLogout() {
    logout();
    navigate("/platform/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span className="brand-name">Sign Shop — Platform</span>
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
              <span className="user-role">{PLATFORM_ROLE_LABEL[user.role]}</span>
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
