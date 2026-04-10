import { Suspense, lazy } from "react"
import { createBrowserRouter, type RouteObject } from "react-router-dom"
import { ProtectedRoute, PermissionGate } from "@/features/auth"
import { AppErrorBoundary } from "./ErrorBoundary"
import type { AppSection } from "@/entities/supabase"
import ComingSoon from "@/pages/ComingSoon"
import AccessDenied from "@/pages/AccessDenied"

// ─── Beet Box (MX Suite Demo) — lazy-loaded, outside Layout wrapper ──────────
const BeetBoxApp         = lazy(() => import("@/features/beet-box/BeetBoxApp").then(m => ({ default: m.BeetBoxApp })))
const BeetBoxRedirect    = lazy(() => import("@/features/beet-box/BeetBoxApp").then(m => ({ default: m.BeetBoxRedirect })))
const WorkOrderDashboard = lazy(() => import("@/features/beet-box/modules/work-orders/WorkOrderDashboard"))
const WorkOrderDetail    = lazy(() => import("@/features/beet-box/modules/work-orders/WorkOrderDetail"))
const WorkOrderCreate    = lazy(() => import("@/features/beet-box/modules/work-orders/WorkOrderCreate"))
const InventoryDashboard = lazy(() => import("@/features/beet-box/modules/inventory/InventoryDashboard"))
const InventoryDetail    = lazy(() => import("@/features/beet-box/modules/inventory/InventoryDetail"))
const PODashboard        = lazy(() => import("@/features/beet-box/modules/purchase-orders/PODashboard"))
const PODetail           = lazy(() => import("@/features/beet-box/modules/purchase-orders/PODetail"))
const POCreate           = lazy(() => import("@/features/beet-box/modules/purchase-orders/POCreate"))
const ToolDashboard      = lazy(() => import("@/features/beet-box/modules/tool-calibration/ToolDashboard"))
const ToolDetail         = lazy(() => import("@/features/beet-box/modules/tool-calibration/ToolDetail"))
const ToolCreate         = lazy(() => import("@/features/beet-box/modules/tool-calibration/ToolCreate"))
const InvoiceDashboard   = lazy(() => import("@/features/beet-box/modules/invoicing/InvoiceDashboard"))
const InvoiceDetail      = lazy(() => import("@/features/beet-box/modules/invoicing/InvoiceDetail"))
const SOPDashboard       = lazy(() => import("@/features/beet-box/modules/sops/SOPDashboard"))
const SOPDetail          = lazy(() => import("@/features/beet-box/modules/sops/SOPDetail"))
const TrainingDashboard  = lazy(() => import("@/features/beet-box/modules/training/TrainingDashboard"))
const TrainingDetail     = lazy(() => import("@/features/beet-box/modules/training/TrainingDetail"))
const SettingsDashboard  = lazy(() => import("@/features/beet-box/modules/settings/SettingsDashboard"))
const FlatRatesManager   = lazy(() => import("@/features/beet-box/modules/managers/FlatRatesManager"))
const CannedActionsManager = lazy(() => import("@/features/beet-box/modules/managers/CannedActionsManager"))
const BeetBoxParts       = lazy(() => import("@/pages/Parts"))
const BeetBoxPartsNew    = lazy(() => import("@/pages/PartsNew"))
const BeetBoxPartsDetail = lazy(() => import("@/pages/PartsDetail"))
const CatalogBrowser     = lazy(() => import("@/features/beet-box/modules/catalog/CatalogBrowser"))
const CatalogDetail      = lazy(() => import("@/features/beet-box/modules/catalog/CatalogDetail"))
const PartsOverview      = lazy(() => import("@/features/beet-box/modules/parts-overview/PartsOverview"))
const ReportsDashboard   = lazy(() => import("@/features/beet-box/modules/reports/ReportsDashboard"))
const ComplianceDash     = lazy(() => import("@/features/beet-box/modules/compliance/ComplianceDashboard"))
const SuppliersList      = lazy(() => import("@/features/beet-box/modules/suppliers/SuppliersList"))
const SupplierDetail     = lazy(() => import("@/features/beet-box/modules/suppliers/SupplierDetail"))

const Layout = lazy(() => import("./layout/Layout").then(m => ({ default: m.Layout })))
const Login = lazy(() => import("@/pages/Login"))
const AuthCallback = lazy(() => import("@/pages/AuthCallback"))
const RequestAccess = lazy(() => import("@/pages/RequestAccess"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const AdminUsers       = lazy(() => import("@/pages/admin/Users"))
const AdminTraining    = lazy(() => import("@/pages/admin/AdminTraining"))
const PermissionsIndex = lazy(() => import("@/pages/admin/PermissionsIndex"))
const SuggestionAdmin  = lazy(() => import("@/pages/admin/SuggestionAdmin"))
const AccessRestricted = lazy(() => import("@/pages/AccessRestricted"))
const AircraftInfo = lazy(() => import("@/pages/AircraftInfo"))
const MyTraining   = lazy(() => import("@/pages/training/MyTraining"))
const MyJourney    = lazy(() => import("@/pages/training/MyJourney"))
const AiAssistant  = lazy(() => import("@/pages/AiAssistant"))
const VendorMap    = lazy(() => import("@/pages/VendorMap"))
const VendorDetailPage = lazy(() => import("@/pages/VendorDetailPage"))
const Compliance   = lazy(() => import("@/pages/Compliance"))
const SafetyHouse  = lazy(() => import("@/pages/SafetyHouse"))
const DiscrepancyIntelligence = lazy(() => import("@/pages/DiscrepancyIntelligence"))
const ExternalRequests = lazy(() => import("@/pages/external-requests/ExternalRequestsPage"))
const ExternalRequestDetail = lazy(() => import("@/pages/external-requests/ExternalRequestDetailPage"))
const ExternalResponse = lazy(() => import("@/pages/external-response/ExternalResponsePage"))
const FourteenDayCheckResponse = lazy(() => import("@/pages/fourteen-day-check/FourteenDayCheckResponse"))
const ApprovalPortalPage       = lazy(() => import("@/pages/approval/ApprovalPortalPage"))
const FourteenDayCheck         = lazy(() => import("@/pages/FourteenDayCheck"))
const InspectionTemplatesPage  = lazy(() => import("@/pages/InspectionTemplatesPage"))
const MaintenancePlanning = lazy(() => import("@/pages/MaintenancePlanning"))
const RecordsVaultApp      = lazy(() => import("@/features/records-vault/RecordsVaultApp").then(m => ({ default: m.RecordsVaultApp })))
const RecordsVaultRedirect = lazy(() => import("@/features/records-vault/RecordsVaultApp").then(m => ({ default: m.RecordsVaultRedirect })))
const RecordsVaultSearch   = lazy(() => import("@/features/records-vault/pages/RecordsVaultSearchPage"))
const RecordsVaultBrowse   = lazy(() => import("@/features/records-vault/pages/RecordsVaultBrowsePage"))
const RecordsVaultTimeline = lazy(() => import("@/features/records-vault/pages/RecordsVaultTimelinePage"))
const RecordsVaultPipeline = lazy(() => import("@/features/records-vault/pages/RecordsVaultPipelinePage"))
const NotFound = lazy(() => import("@/pages/NotFound"))
const ProjectsApp = lazy(() => import("@/features/projects/ProjectsApp"))

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-muted-foreground text-sm">Loading…</div>
  </div>
)

function wrap(element: React.ReactNode) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={fallback}>{element}</Suspense>
    </AppErrorBoundary>
  )
}

/** Wrap a page element with both permission enforcement and Suspense/ErrorBoundary */
function guard(section: AppSection, element: React.ReactNode, opts?: { adminOnly?: boolean; superAdminOnly?: boolean }) {
  return wrap(
    <PermissionGate section={section} adminOnly={opts?.adminOnly} superAdminOnly={opts?.superAdminOnly}>
      {element}
    </PermissionGate>
  )
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: wrap(<Login />),
  },
  {
    path: "/auth/callback",
    element: wrap(<AuthCallback />),
  },
  {
    path: "/request-access",
    element: wrap(<RequestAccess />),
  },
  {
    // External Requests public response portal — no auth required
    path: "/r/:token",
    element: wrap(<ExternalResponse />),
  },
  {
    // 14-Day Check permanent standing form — no auth required
    path: "/check/:token",
    element: wrap(<FourteenDayCheckResponse />),
  },
  {
    // Customer quote/change-order approval portal — no auth required
    path: "/approval/:token",
    element: wrap(<ApprovalPortalPage />),
  },
  {
    path: "/app",
    element: (
      <AppErrorBoundary>
        <ProtectedRoute>
          <Suspense fallback={fallback}>
            <Layout />
          </Suspense>
        </ProtectedRoute>
      </AppErrorBoundary>
    ),
    children: [
      // ── Always accessible (Dashboard is a default permission) ──────
      { index: true,                       element: guard("Dashboard", <Dashboard />) },
      { path: "access-restricted",         element: wrap(<AccessRestricted />) },

      // ── Overview ───────────────────────────────────────────────────
      { path: "aircraft",                  element: guard("Aircraft Info", <AircraftInfo />) },
      { path: "ai-assistant",              element: guard("AI Assistant", <AiAssistant />) },

      // ── Operations ─────────────────────────────────────────────────
      { path: "discrepancy-intelligence",  element: guard("Discrepancy Intelligence", <DiscrepancyIntelligence />) },
      { path: "vendor-map",               element: guard("Vendor Map", <VendorMap />) },
      { path: "vendors/:id",              element: guard("Vendor Map", <VendorDetailPage />) },
      { path: "14-day-check",             element: guard("14-Day Check", <FourteenDayCheck />) },
      { path: "14-day-check/templates",   element: guard("14-Day Check", <InspectionTemplatesPage />) },
      { path: "projects",                 element: guard("Projects", <ProjectsApp />) },
      { path: "projects/:boardId",        element: guard("Projects", <ProjectsApp />) },
      { path: "compliance",               element: guard("Compliance", <Compliance />) },
      { path: "safety",                   element: guard("Safety", <SafetyHouse />) },
      { path: "external-requests",        element: guard("External Requests", <ExternalRequests />) },
      { path: "external-requests/:id",    element: guard("External Requests", <ExternalRequestDetail />) },
      { path: "training",                 element: guard("My Training", <MyTraining />) },
      { path: "journey",                  element: guard("My Journey", <MyJourney />) },

      // ── Pending Cert. ──────────────────────────────────────────────
      { path: "conformity",               element: guard("Aircraft Conformity", <ComingSoon name="Aircraft Conformity" />) },
      { path: "planning",                 element: guard("Maintenance Planning", <MaintenancePlanning />) },
      { path: "ten-or-more",              element: guard("Ten or More", <ComingSoon name="Ten or More" />) },
      { path: "terminal-ogd",             element: guard("Terminal-OGD", <ComingSoon name="Terminal-OGD" />) },
      { path: "docs",                     element: guard("Docs & Links", <ComingSoon name="Docs & Links" />) },

      // ── Admin (admin-only) ─────────────────────────────────────────
      { path: "admin/users",              element: guard("Dashboard", <AdminUsers />, { adminOnly: true }) },
      { path: "admin/training",           element: guard("Dashboard", <AdminTraining />, { superAdminOnly: true }) },
      { path: "admin/permissions",        element: guard("Dashboard", <PermissionsIndex />, { superAdminOnly: true }) },
      { path: "admin/suggestions",        element: guard("Dashboard", <SuggestionAdmin />, { superAdminOnly: true }) },
      { path: "admin/settings",           element: guard("Dashboard", <ComingSoon name="Admin Settings" />, { adminOnly: true }) },

      // ── Dev / fallback ─────────────────────────────────────────────
      { path: "dev/access-denied",        element: wrap(<AccessDenied name="Aircraft Conformity" />) },
      { path: "*",                        element: wrap(<NotFound />) },
    ],
  },
  // ─── Beet Box — full-screen, outside Layout, protected ─────────────────────
  {
    path: "/app/beet-box",
    element: (
      <AppErrorBoundary>
        <ProtectedRoute>
          <Suspense fallback={fallback}>
            <BeetBoxApp />
          </Suspense>
        </ProtectedRoute>
      </AppErrorBoundary>
    ),
    children: [
      { index: true,                              element: guard("Work Orders", <BeetBoxRedirect />) },
      { path: "work-orders",                      element: guard("Work Orders", <WorkOrderDashboard />) },
      { path: "work-orders/new",                  element: guard("Work Orders", <WorkOrderCreate />) },
      { path: "work-orders/:id",                  element: guard("Work Orders", <WorkOrderDetail />) },
      { path: "inventory",                        element: guard("Work Orders", <InventoryDashboard />) },
      { path: "inventory/:id",                    element: guard("Work Orders", <InventoryDetail />) },
      { path: "purchase-orders",                  element: guard("Work Orders", <PODashboard />) },
      { path: "purchase-orders/new",              element: guard("Work Orders", <POCreate />) },
      { path: "purchase-orders/:id",              element: guard("Work Orders", <PODetail />) },
      { path: "tool-calibration",                 element: guard("Work Orders", <ToolDashboard />) },
      { path: "tool-calibration/new",             element: guard("Work Orders", <ToolCreate />) },
      { path: "tool-calibration/:id",             element: guard("Work Orders", <ToolDetail />) },
      { path: "invoicing",                        element: guard("Work Orders", <InvoiceDashboard />) },
      { path: "invoicing/:id",                    element: guard("Work Orders", <InvoiceDetail />) },
      { path: "sop-library",                      element: guard("Work Orders", <SOPDashboard />) },
      { path: "sop-library/:id",                  element: guard("Work Orders", <SOPDetail />) },
      { path: "training",                         element: guard("Work Orders", <TrainingDashboard />) },
      { path: "training/:id",                     element: guard("Work Orders", <TrainingDetail />) },
      { path: "settings",                         element: guard("Work Orders", <SettingsDashboard />, { adminOnly: true }) },
      { path: "flat-rates",                       element: guard("Work Orders", <FlatRatesManager />, { adminOnly: true }) },
      { path: "canned-actions",                   element: guard("Work Orders", <CannedActionsManager />, { adminOnly: true }) },
      { path: "parts",                            element: guard("Parts", <BeetBoxParts />) },
      { path: "parts/new",                        element: guard("Parts", <BeetBoxPartsNew />) },
      { path: "parts/:id",                        element: guard("Parts", <BeetBoxPartsDetail />) },
      { path: "catalog",                          element: guard("Parts", <CatalogBrowser />) },
      { path: "catalog/:id",                      element: guard("Parts", <CatalogDetail />) },
      { path: "parts-overview",                   element: guard("Parts", <PartsOverview />) },
      { path: "reports",                          element: guard("Work Orders", <ReportsDashboard />) },
      { path: "compliance",                       element: guard("Compliance", <ComplianceDash />) },
      { path: "suppliers",                        element: guard("Work Orders", <SuppliersList />) },
      { path: "suppliers/:id",                    element: guard("Work Orders", <SupplierDetail />) },
    ],
  },
  // ─── Records Vault — full-screen, outside Layout, protected ───────────────
  {
    path: "/app/records-vault",
    element: (
      <AppErrorBoundary>
        <ProtectedRoute>
          <Suspense fallback={fallback}>
            <RecordsVaultApp />
          </Suspense>
        </ProtectedRoute>
      </AppErrorBoundary>
    ),
    children: [
      { index: true,           element: guard("Records Vault", <RecordsVaultRedirect />) },
      { path: "search",        element: guard("Records Vault", <RecordsVaultSearch />) },
      { path: "browse",        element: guard("Records Vault", <RecordsVaultBrowse />) },
      { path: "timeline",      element: guard("Records Vault", <RecordsVaultTimeline />) },
      { path: "pipeline",      element: guard("Records Vault", <RecordsVaultPipeline />) },
    ],
  },
  {
    path: "*",
    element: wrap(<NotFound />),
  },
]

export const router = createBrowserRouter(routes)
