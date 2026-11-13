import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { cn } from "@/lib/utils";
import { navFor, ROLE_LABELS } from "@/routes/access";

// The signed-in frame: a sidebar on wide screens, a bottom bar on phones; the business name, the
// person's name and role, and sign out.
export function AppShell() {
  const { session, logout } = useSellerAuth();
  const items = navFor(session);
  const role = session?.user?.role;

  return (
    <div className="min-h-screen bg-brand-page md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar-gradient text-white md:flex">
        <div className="flex items-center gap-2 px-5 py-6">
          <div className="h-7 w-7 rounded-lg bg-brand-gradient" />
          <span className="font-bold">Yulo Partner</span>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-white/10 font-semibold text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-semibold text-brand-dark"
              data-testid="business-name"
            >
              {session?.seller?.businessName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session?.user?.name}
            </p>
          </div>
          {role ? (
            <Badge
              variant={
                role === "owner"
                  ? "danger"
                  : role === "manager"
                    ? "info"
                    : "muted"
              }
            >
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-white md:hidden"
          aria-label="Main navigation (mobile)"
        >
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex min-w-[76px] flex-1 flex-col items-center gap-1 px-2 py-2 text-[11px]",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
