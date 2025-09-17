export default function Dashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
          Welcome to SkyShare Maintenance Portal
        </h1>
        <p className="text-lg text-muted-foreground">
          Your central hub for aircraft maintenance operations and oversight.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-heading font-semibold text-lg mb-2">Overview</h3>
          <p className="text-muted-foreground text-sm">
            Monitor your fleet status and maintenance schedules at a glance.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-heading font-semibold text-lg mb-2">Operations</h3>
          <p className="text-muted-foreground text-sm">
            Access maintenance tools, planning, and operational controls.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-heading font-semibold text-lg mb-2">Administration</h3>
          <p className="text-muted-foreground text-sm">
            Manage users, settings, and system configurations.
          </p>
        </div>
      </div>
    </div>
  );
}