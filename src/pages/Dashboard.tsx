import { Calendar, Wrench, FileText, TrendingUp } from "lucide-react"
import { useAuth } from "@/features/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { Skeleton } from "@/shared/ui/skeleton"

const kpiCards = [
  {
    title: "Active Aircraft",
    value: "—",
    note: "Loading fleet data",
    icon: TrendingUp,
    accent: "var(--skyshare-gold)",
    iconBg: "rgba(212,160,23,0.15)",
    border: "var(--skyshare-gold)",
  },
  {
    title: "Upcoming Checks",
    value: "—",
    note: "Next 30 days",
    icon: Wrench,
    accent: "var(--skyshare-blue-mid)",
    iconBg: "rgba(70,100,129,0.2)",
    border: "var(--skyshare-blue-mid)",
  },
  {
    title: "Open Issues",
    value: "—",
    note: "Across all aircraft",
    icon: Calendar,
    accent: "var(--skyshare-red)",
    iconBg: "rgba(220,50,50,0.15)",
    border: "var(--skyshare-red)",
  },
  {
    title: "Documentation",
    value: "—",
    note: "Total documents",
    icon: FileText,
    accent: "var(--skyshare-success)",
    iconBg: "rgba(16,185,129,0.15)",
    border: "var(--skyshare-success)",
  },
]

const activityCards = [
  {
    title: "Upcoming Events",
    description: "Next maintenance activities",
    icon: Calendar,
    accent: "var(--skyshare-gold)",
    iconBg: "rgba(212,160,23,0.15)",
    empty: "Looks quiet for now — your maintenance events will appear here.",
  },
  {
    title: "Open 14-Day Checks",
    description: "Active inspection cycles",
    icon: Wrench,
    accent: "var(--skyshare-blue-mid)",
    iconBg: "rgba(70,100,129,0.2)",
    empty: "No active checks right now. New inspections will show up here.",
  },
  {
    title: "Recent Notes",
    description: "Latest maintenance entries",
    icon: FileText,
    accent: "var(--skyshare-success)",
    iconBg: "rgba(16,185,129,0.15)",
    empty: "Start documenting — your notes and updates will live here.",
  },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const firstName = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "there"

  return (
    <div className="space-y-8">

      {/* Hero heading with faint diagonal line bg */}
      <div className="hero-area">
        <h1
          className="text-[2.6rem] leading-none text-foreground"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
        >
          Welcome back, {firstName.toUpperCase()}
        </h1>
        {/* Gold rule */}
        <div
          className="mt-2 mb-2"
          style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }}
        />
        <p
          className="text-sm text-muted-foreground"
          style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}
        >
          Maintenance Operations Overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(card => (
          <Card
            key={card.title}
            className="card-elevated card-hoverable border-0"
            style={{ borderLeft: `3px solid ${card.border}` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle
                className="text-muted-foreground"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                {card.title}
              </CardTitle>
              <div
                className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: card.iconBg }}
              >
                <card.icon className="h-4 w-4" style={{ color: card.accent }} />
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)", cursor: "default" }}
              >
                {card.value}
              </div>
              <p
                className="text-xs text-muted-foreground mt-1"
                style={{ letterSpacing: "0.05em", cursor: "default" }}
              >
                {card.note}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stripe divider */}
      <div className="stripe-divider" />

      {/* Activity Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {activityCards.map(card => (
          <Card
            key={card.title}
            className="card-elevated card-hoverable border-0"
            style={{ borderTop: `2px solid var(--skyshare-gold)` }}
          >
            <CardHeader className="pb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <CardTitle
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                {card.title}
              </CardTitle>
              <CardDescription className="text-xs">{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="text-center py-6">
                <div
                  className="h-11 w-11 rounded flex items-center justify-center mx-auto mb-3"
                  style={{ background: card.iconBg }}
                >
                  <card.icon className="h-5 w-5" style={{ color: card.accent }} />
                </div>
                <p
                  className="text-xs leading-relaxed max-w-[200px] mx-auto"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {card.empty}
                </p>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full skeleton-gold" />
                <Skeleton className="h-3 w-4/5 skeleton-gold" />
                <Skeleton className="h-3 w-3/5 skeleton-gold" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
