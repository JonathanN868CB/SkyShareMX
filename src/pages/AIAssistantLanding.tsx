import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  ClipboardList,
  Database,
  FileText,
  LineChart,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { aiAssistantHeroImage } from "@/assets/ai-assistant-hero";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type FeatureHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets?: string[];
};

type KnowledgeSource = {
  label: string;
  icon: LucideIcon;
};

type RoadmapStage = "pilot" | "design" | "vision";

type RoadmapItem = {
  stage: string;
  tone: RoadmapStage;
  title: string;
  description: string;
  icon: LucideIcon;
  milestones: string[];
};

const featureHighlights: FeatureHighlight[] = [
  {
    title: "Context-aware copilots",
    description:
      "Pair maintainers with an assistant that understands every tail number, work order, and deferment in flight control.",
    icon: BrainCircuit,
    bullets: [
      "Cross-reference open discrepancies with historical fixes and vendor recommendations.",
      "Surface torque values, task cards, and required tooling the moment a job is assigned.",
    ],
  },
  {
    title: "Predictive maintenance intelligence",
    description:
      "Model component fatigue and forecast downtime so schedules, crews, and parts arrive before issues escalate.",
    icon: LineChart,
    bullets: [
      "Blend flight hours, landings, and telemetry trends to flag risk windows early.",
      "Translate predictions into maintenance windows that respect customer commitments.",
    ],
  },
  {
    title: "Automated follow-through",
    description:
      "Generate compliant documentation, update Supabase records, and notify teams without waiting on manual data entry.",
    icon: Workflow,
    bullets: [
      "Draft logbook entries, MEL references, and return-to-service notes for supervisor approval.",
      "Route action items to parts, QA, and field teams as soon as work orders close.",
    ],
  },
];

const knowledgeSources: KnowledgeSource[] = [
  { label: "Maintenance event history", icon: ClipboardList },
  { label: "Aircraft telemetry & trends", icon: Activity },
  { label: "MEL / CDL libraries", icon: FileText },
  { label: "Regulatory compliance guides", icon: ShieldCheck },
  { label: "Vendor SB & AD feeds", icon: RadioTower },
  { label: "Ops scheduling data", icon: CalendarCheck },
  { label: "SkyShare Supabase source of truth", icon: Database },
];

const roadmapStages: Record<RoadmapStage, string> = {
  pilot: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  design: "border-amber-200/80 bg-amber-50 text-amber-700",
  vision: "border-indigo-200/80 bg-indigo-50 text-indigo-700",
};

const roadmap: RoadmapItem[] = [
  {
    stage: "In pilot · Q3 2024",
    tone: "pilot",
    title: "MX Ops Copilot",
    description:
      "Live experiments with maintenance control deliver conversational triage, daily anomaly briefs, and curated task prep.",
    icon: Sparkles,
    milestones: [
      "Summaries of the overnight backlog with risk and grounding blockers highlighted.",
      "Suggested next-best-actions auto-aligned to fleet availability and technician coverage.",
    ],
  },
  {
    stage: "In design · Q4 2024",
    tone: "design",
    title: "Predictive health forecasting",
    description:
      "Component models tie utilization, environment, and vendor data together to schedule maintenance before failure.",
    icon: LineChart,
    milestones: [
      "Probability dashboards for aircraft systems with lead time for parts procurement.",
      "Automated slotting of forecasted work into the integrated maintenance calendar.",
    ],
  },
  {
    stage: "Vision · 2025",
    tone: "vision",
    title: "Closed-loop hangar automation",
    description:
      "The assistant orchestrates planning, execution, and reporting so teams focus on decisions—not paperwork.",
    icon: Workflow,
    milestones: [
      "Generate workcards, staffing plans, and SMS notifications as schedules evolve.",
      "Continuous compliance audit trails with ready-to-file documentation packages.",
    ],
  },
];

export default function AIAssistantLanding() {
  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,1fr)] items-center">
        <div className="space-y-6">
          <Badge className="w-fit border border-primary/20 bg-primary/10 text-primary">
            AI Assistant preview
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-heading font-bold text-foreground sm:text-5xl">
              SkyShare AI Maintenance Assistant
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              We&apos;re building an intelligent copilot that keeps every aircraft airworthy—pairing generative reasoning with
              the data backbone SkyShare trusts today.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Embedded in maintenance control</p>
              <p>Answer questions, prep work orders, and brief leadership from a single conversational canvas.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Grounded in secure data</p>
              <p>Responses cite the same Supabase-backed knowledge base your team already curates.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild className="gap-2">
              <a href="mailto:innovation@skyshare.com?subject=AI%20Assistant%20Pilot">
                Request early access
                <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </Button>
            <span className="text-sm text-muted-foreground">
              Pilots with maintenance control and field teams roll out later this year.
            </span>
          </div>
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 blur-3xl"
            style={{
              background:
                "radial-gradient(120% 120% at 20% 0%, rgba(216,235,255,0.7), transparent), radial-gradient(120% 120% at 80% 20%, rgba(233,215,255,0.6), transparent)",
            }}
          />
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-background via-background/80 to-background/40 shadow-xl ring-1 ring-black/5">
            <img
              src={aiAssistantHeroImage}
              alt="Illustration of the SkyShare AI assistant collaborating with maintenance teams"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-2xl font-heading font-semibold text-foreground">What the assistant will unlock</h2>
          <p className="max-w-3xl text-muted-foreground">
            Built with SkyShare maintainers, the assistant accelerates every step of the maintenance lifecycle—from discovery and
            planning through documentation and compliance.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featureHighlights.map(feature => (
            <Card key={feature.title} className="h-full border-border/60 bg-card/90">
              <CardHeader className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <feature.icon aria-hidden className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </CardHeader>
              {feature.bullets?.length ? (
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {feature.bullets.map(point => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-semibold text-foreground">Grounded in trusted sources</h2>
          <p className="max-w-3xl text-muted-foreground">
            Every response references the same systems that power SkyShare operations today, keeping the assistant auditable and
            verifiable by your team.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {knowledgeSources.map(source => (
            <Badge
              key={source.label}
              variant="outline"
              className="flex items-center gap-2 border-dashed border-border/60 bg-muted/30 text-muted-foreground"
            >
              <source.icon aria-hidden className="h-3.5 w-3.5 text-primary" />
              {source.label}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-semibold text-foreground">Roadmap to the assistant</h2>
          <p className="max-w-3xl text-muted-foreground">
            We&apos;re releasing capabilities in waves so teams can validate impact, guide the model, and build trust before full
            automation.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {roadmap.map(item => (
            <Card key={item.title} className="h-full border-border/60 bg-card/90">
              <CardHeader className="space-y-4">
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit border text-[0.7rem] font-medium uppercase tracking-wide",
                    roadmapStages[item.tone],
                  )}
                >
                  {item.stage}
                </Badge>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon aria-hidden className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl text-foreground">{item.title}</CardTitle>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {item.milestones.map(milestone => (
                    <li key={milestone} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                      <span className="leading-relaxed">{milestone}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card className="relative overflow-hidden border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-lg">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(140% 140% at 0% 100%, rgba(223, 242, 255, 0.6), transparent), radial-gradient(120% 120% at 100% 0%, rgba(218, 213, 255, 0.6), transparent)",
            }}
          />
          <CardHeader className="space-y-3">
            <Badge className="w-fit border border-primary/30 bg-primary/20 text-primary">
              Co-design invitation
            </Badge>
            <CardTitle className="text-3xl font-heading text-foreground">
              Partner with the AI build crew
            </CardTitle>
            <p className="max-w-3xl text-base text-muted-foreground">
              We&apos;re inviting maintainers, controllers, and reliability engineers to shape the assistant from day one. Share the
              workflows that slow you down and we&apos;ll craft automation loops that return hours to the operation.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground sm:max-w-2xl">
              Early partners join discovery workshops, get sandbox access, and influence how the assistant cites, documents, and
              acts across the fleet.
            </p>
            <Button asChild size="lg" className="gap-2">
              <a href="mailto:innovation@skyshare.com?subject=AI%20Assistant%20Pilot">
                Book a design session
                <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
