import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpenCheck,
  Database,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AI_ASSISTANT_HERO_IMAGE } from "@/assets/ai-assistant-hero";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const featureHighlights = [
  {
    title: "Context built from our data",
    description:
      "Connects employee handbooks, fleet manuals, maintenance procedures, and compliance documents so every reply mirrors how SkyShare actually operates.",
    icon: BookOpenCheck,
  },
  {
    title: "Instant access to history",
    description:
      "Surface aircraft records, inspection logs, and component status with a single prompt—no more hunting through disparate systems.",
    icon: Database,
  },
  {
    title: "Answers you can trust",
    description:
      "Role-aware responses that cite their sources, respect maintenance authorizations, and keep our operation compliant.",
    icon: ShieldCheck,
  },
] satisfies Array<{ title: string; description: string; icon: LucideIcon }>;

const knowledgeDomains = [
  "Employee handbook",
  "Aircraft maintenance manuals",
  "Inspection & compliance checklists",
  "Training and onboarding guides",
  "Operations & scheduling memos",
  "Parts and tooling records",
  "Safety reports & SMS notes",
  "Vendor & support contacts",
];

const roadmap = [
  {
    title: "Discovery interviews",
    window: "Active now",
    description:
      "Capturing the questions technicians, leads, and leadership ask every day to map required data sources and guardrails.",
    icon: Search,
  },
  {
    title: "Private hangar beta",
    window: "Q2",
    description:
      "Wire the LLM into secured knowledge bases, deliver cited answers, and iterate with an invite-only group of maintainers.",
    icon: Sparkles,
  },
  {
    title: "Flight line launch",
    window: "Q3",
    description:
      "Roll the assistant out company-wide with permission-aware access tied to maintenance roles and operational readiness.",
    icon: Rocket,
  },
] satisfies Array<{ title: string; window: string; description: string; icon: LucideIcon }>;

export default function AIAssistantLanding() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 py-2">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-white shadow-xl">
        <img
          src={AI_ASSISTANT_HERO_IMAGE}
          alt="SkyShare jet rendered as a hero image for the AI assistant powered by ChatGPT and OpenAI."
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-slate-900/70" />
        <div className="relative z-10 flex flex-col gap-8 px-8 py-16 sm:px-12 lg:px-16">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/90">
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 tracking-[0.28em]">
              Coming soon
            </span>
            <span className="text-slate-100/75">ChatGPT + OpenAI under the hood</span>
          </div>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              SkyShare Maintenance AI Assistant
            </h1>
            <p className="text-lg text-slate-100/85">
              This will be the future home for technicians to ask anything about how SkyShare keeps the fleet
              flying—from employee handbooks and aircraft manuals to procedural documents and parts history.
            </p>
            <p className="text-sm text-slate-100/70">
              Powered by large language models tuned with SkyShare&apos;s real data so manuals, records, and
              history are always one prompt away.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-white px-6 py-3 text-slate-950 shadow-lg hover:bg-white/90"
            >
              <a href="mailto:maintenance@skyshare.com?subject=AI%20Assistant%20Preview">
                Request early access
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/50 bg-white/10 px-6 py-3 text-white hover:bg-white/15"
            >
              <a href="mailto:maintenance@skyshare.com?subject=AI%20Assistant%20Questions">
                Tell us the questions you want answered
              </a>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-6 right-6 hidden max-w-xs rounded-2xl border border-white/20 bg-white/10 p-4 text-right text-xs leading-relaxed text-slate-100/80 backdrop-blur-md md:block">
          Manuals, records, history—one prompt away.
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Built for the hangar</h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Ask natural language questions and get role-aware answers grounded in SkyShare procedures and aircraft
          data.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {featureHighlights.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-slate-200/70 bg-card/95 shadow-sm">
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80">
                    {description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/80 p-10 shadow-sm">
        <h2 className="text-2xl font-semibold text-foreground">What it will know</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connected to the systems our technicians rely on so every answer reflects current policy and aircraft status.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {knowledgeDomains.map(domain => (
            <Badge
              key={domain}
              variant="outline"
              className="border-slate-300/70 bg-white/80 text-slate-700"
            >
              {domain}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-foreground">Roadmap to launch</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {roadmap.map(({ title, window, description, icon: Icon }) => (
            <Card key={title} className="border-slate-200/80 bg-card shadow-sm">
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-xs uppercase tracking-[0.25em] text-primary">
                    {window}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">{description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-r from-sky-500/10 via-primary/10 to-indigo-500/10 px-10 py-12 shadow-sm">
        <h2 className="text-2xl font-semibold text-foreground">Help shape the assistant</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          We&apos;re mapping the data sources and workflows the assistant needs to understand. Share scenarios and documents so we can tune the experience before launch.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Button asChild size="lg">
            <a href="mailto:maintenance@skyshare.com?subject=AI%20Assistant%20Use%20Case">Share a use case</a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            <a href="mailto:maintenance@skyshare.com?subject=AI%20Assistant%20Updates">Get launch updates</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
