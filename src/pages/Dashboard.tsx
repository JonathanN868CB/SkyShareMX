import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/shared/lib/utils";

type DashboardCard = {
  key: string;
  title: string;
  description: string;
};

export default function Dashboard() {
  const { hasPermission, loading } = useUserPermissions();

  const cards: DashboardCard[] = [
    {
      key: "overview",
      title: "Overview",
      description:
        "Monitor your fleet status and maintenance schedules at a glance.",
    },
  ];

  const shouldShowOperations = loading || hasPermission("Operations");
  const shouldShowAdministration = loading || hasPermission("Administration");

  if (shouldShowOperations) {
    cards.push({
      key: "operations",
      title: "Operations",
      description:
        "Access maintenance tools, planning, and operational controls.",
    });
  }

  if (shouldShowAdministration) {
    cards.push({
      key: "administration",
      title: "Administration",
      description: "Manage users, settings, and system configurations.",
    });
  }

  const cardCount = cards.length;

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

      <div
        className={cn(
          "grid gap-6",
          "grid-cols-1",
          cardCount >= 2 && "md:grid-cols-2",
          cardCount >= 3 && "lg:grid-cols-3",
          cardCount === 1 && "max-w-xl mx-auto",
        )}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            className="bg-card rounded-lg border border-border p-6"
          >
            <h3 className="font-heading font-semibold text-lg mb-2">
              {card.title}
            </h3>
            <p className="text-muted-foreground text-sm">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}