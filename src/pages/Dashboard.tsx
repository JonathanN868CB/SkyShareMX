import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

import type { Tables } from "@/entities/supabase";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/shared/lib/utils";
import { showAccessDenied } from "@/shared/ui/access-denied-dialog";
import { Badge } from "@/shared/ui/badge";

type AppSection = Tables<"user_permissions">["section"];

type DashboardCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  requiresPermission?: AppSection;
};

export default function Dashboard() {
  const { hasPermission, loading } = useUserPermissions();

  const cards: DashboardCard[] = [
    {
      key: "overview",
      title: "Overview",
      description:
        "Monitor your fleet status and maintenance schedules at a glance.",
      href: "/app",
    },
    {
      key: "operations",
      title: "Operations",
      description: "Access maintenance tools, planning, and operational controls.",
      href: "/app/under-construction",
      requiresPermission: "Operations",
    },
    {
      key: "administration",
      title: "Administration",
      description: "Manage users, settings, and system configurations.",
      href: "/app/admin/users",
      requiresPermission: "Administration",
    },
  ];

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
        {cards.map(card => {
          const isCheckingAccess = Boolean(card.requiresPermission) && loading;
          const hasAccess =
            !card.requiresPermission || hasPermission(card.requiresPermission);
          const isLocked = Boolean(card.requiresPermission) && !loading && !hasAccess;

          const cardClasses = cn(
            "group relative flex h-full w-full flex-col gap-6 rounded-lg border border-border bg-card p-6 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer",
            hasAccess
              ? "hover:border-primary/60 hover:shadow-md focus-visible:ring-primary/40"
              : "focus-visible:ring-destructive/30",
            isLocked && "opacity-80",
            isCheckingAccess && "cursor-progress",
          );

          const bodyContent = (
            <>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading font-semibold text-lg text-foreground">
                    {card.title}
                  </h3>
                  {isLocked && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 border-border/60 text-muted-foreground"
                    >
                      <Lock aria-hidden className="h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </div>
              <div className="mt-auto text-sm font-medium text-muted-foreground">
                {isCheckingAccess ? (
                  <span className="text-muted-foreground/70">Checking access…</span>
                ) : hasAccess ? (
                  <span className="text-primary">Enter module →</span>
                ) : (
                  <span>Requires additional permissions</span>
                )}
              </div>
            </>
          );

          if (hasAccess) {
            return (
              <Link key={card.key} to={card.href} className={cardClasses}>
                {bodyContent}
              </Link>
            );
          }

          return (
            <button
              key={card.key}
              type="button"
              className={cardClasses}
              onClick={() => {
                if (!isCheckingAccess) {
                  showAccessDenied();
                }
              }}
              disabled={isCheckingAccess}
              aria-disabled={isCheckingAccess}
            >
              {bodyContent}
            </button>
          );
        })}
      </div>
    </div>
  );
}