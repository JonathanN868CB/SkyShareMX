import { Link } from "react-router-dom";
import { ArrowRight, Clock3, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

const highlights = [
  {
    title: "Centralize every squawk",
    description: "Capture discrepancies, work cards, and approvals in one workspace your crew can trust.",
    icon: Wrench,
  },
  {
    title: "Stay audit-ready",
    description: "Automated recordkeeping keeps your DOM and QA teams aligned on aircraft status.",
    icon: ShieldCheck,
  },
  {
    title: "Know what's next",
    description: "Real-time activity feeds and alerts surface the tasks that unblock tomorrow's flights.",
    icon: Clock3,
  },
];

const Index = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/60">
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl" />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-16 pt-24 md:gap-24 md:pb-24 md:pt-32">
        <div className="grid gap-12 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div className="space-y-8">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              SkyShareMX Maintenance Operations
            </Badge>
            <div className="space-y-4">
              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Keep your fleet maintenance moving forward together.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                SkyShareMX centralizes maintenance planning, squawk resolution, and quality control so pilots, DOMs, and
                technicians know exactly what is flying next.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" asChild>
                <Link to="/login" className="text-base">
                  Log in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/request-access" className="text-base">
                  Request access
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                <span>Secure Google SSO for verified SkyShare crew</span>
              </div>
              <span className="hidden sm:block" aria-hidden>
                •
              </span>
              <span>Read-only by default, elevated by maintenance leadership</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-border/60 bg-card/80 backdrop-blur">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-card/60 p-8 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">Need access?</p>
            <h2 className="font-heading text-2xl font-semibold text-foreground">
              Not on the roster yet? Share a few details with the maintenance team.
            </h2>
            <p className="text-sm text-muted-foreground">
              We review every request to keep the fleet secure. Tell us who you fly or wrench for and how we can help.
            </p>
          </div>
          <Button size="lg" asChild className="self-start">
            <Link to="/request-access" className="text-base">
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
