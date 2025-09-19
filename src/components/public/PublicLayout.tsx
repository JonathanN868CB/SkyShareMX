import { Link, Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              S
            </span>
            <span>SkyShare Maintenance Portal</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Log in
            </Link>
            <Link
              to="/request-access"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Request access
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
