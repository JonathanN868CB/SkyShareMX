import { Suspense, lazy } from "react"
import { createBrowserRouter, type RouteObject } from "react-router-dom"
import { ProtectedRoute } from "@/features/auth"
import { AppErrorBoundary } from "./ErrorBoundary"
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
const InvoiceDashboard   = lazy(() => import("@/features/beet-box/modules/invoicing/InvoiceDashboard"))
const InvoiceDetail      = lazy(() => import("@/features/beet-box/modules/invoicing/InvoiceDetail"))
const LogbookDashboard   = lazy(() => import("@/features/beet-box/modules/logbook/LogbookDashboard"))
const LogbookDetail      = lazy(() => import("@/features/beet-box/modules/logbook/LogbookDetail"))
const SOPDashboard       = lazy(() => import("@/features/beet-box/modules/sops/SOPDashboard"))
const SOPDetail          = lazy(() => import("@/features/beet-box/modules/sops/SOPDetail"))
const TrainingDashboard  = lazy(() => import("@/features/beet-box/modules/training/TrainingDashboard"))
const TrainingDetail     = lazy(() => import("@/features/beet-box/modules/training/TrainingDetail"))
const SettingsDashboard  = lazy(() => import("@/features/beet-box/modules/settings/SettingsDashboard"))

const Layout = lazy(() => import("./layout/Layout").then(m => ({ default: m.Layout })))
const Login = lazy(() => import("@/pages/Login"))
const AuthCallback = lazy(() => import("@/pages/AuthCallback"))
const RequestAccess = lazy(() => import("@/pages/RequestAccess"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const AdminUsers     = lazy(() => import("@/pages/admin/Users"))
const AdminTraining  = lazy(() => import("@/pages/admin/AdminTraining"))
const PermissionsIndex = lazy(() => import("@/pages/admin/PermissionsIndex"))
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
const Parts = lazy(() => import("@/pages/Parts"))
const PartsNew = lazy(() => import("@/pages/PartsNew"))
const PartsDetail = lazy(() => import("@/pages/PartsDetail"))
const ExternalRequests = lazy(() => import("@/pages/external-requests/ExternalRequestsPage"))
const ExternalRequestDetail = lazy(() => import("@/pages/external-requests/ExternalRequestDetailPage"))
const ExternalResponse = lazy(() => import("@/pages/external-response/ExternalResponsePage"))
const FourteenDayCheckResponse = lazy(() => import("@/pages/fourteen-day-check/FourteenDayCheckResponse"))
const FourteenDayCheck = lazy(() => import("@/pages/FourteenDayCheck"))
const RecordsVaultApp      = lazy(() => import("@/features/records-vault/RecordsVaultApp").then(m => ({ default: m.RecordsVaultApp })))
const RecordsVaultRedirect = lazy(() => import("@/features/records-vault/RecordsVaultApp").then(m => ({ default: m.RecordsVaultRedirect })))
const RecordsVaultSearch   = lazy(() => import("@/features/records-vault/pages/RecordsVaultSearchPage"))
const RecordsVaultBrowse   = lazy(() => import("@/features/records-vault/pages/RecordsVaultBrowsePage"))
const RecordsVaultTimeline = lazy(() => import("@/features/records-vault/pages/RecordsVaultTimelinePage"))
const RecordsVaultPipeline = lazy(() => import("@/features/records-vault/pages/RecordsVaultPipelinePage"))
const NotFound = lazy(() => import("@/pages/NotFound"))

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
      {
        index: true,
        element: wrap(<Dashboard />),
      },
      { path: "aircraft",    element: wrap(<AircraftInfo />) },
      { path: "vendor-map",  element: wrap(<VendorMap />) },
      { path: "vendors/:id", element: wrap(<VendorDetailPage />) },
      { path: "dev/access-denied", element: wrap(<AccessDenied name="Aircraft Conformity" />) },
      { path: "ai-assistant", element: wrap(<AiAssistant />) },
      { path: "conformity",  element: wrap(<ComingSoon name="Aircraft Conformity" />) },
      { path: "14-day-check", element: wrap(<FourteenDayCheck />) },
      { path: "planning",    element: wrap(<ComingSoon name="Maintenance Planning" />) },
      { path: "ten-or-more", element: wrap(<ComingSoon name="Ten or More" />) },
      { path: "terminal-ogd", element: wrap(<ComingSoon name="Terminal-OGD" />) },
      { path: "projects",    element: wrap(<ComingSoon name="Projects" />) },
      { path: "compliance",   element: wrap(<Compliance />) },
      { path: "safety",       element: wrap(<SafetyHouse />) },
      { path: "discrepancy-intelligence", element: wrap(<DiscrepancyIntelligence />) },
      { path: "parts",        element: wrap(<Parts />) },
      { path: "parts/new",    element: wrap(<PartsNew />) },
      { path: "parts/:id",    element: wrap(<PartsDetail />) },
      { path: "external-requests",     element: wrap(<ExternalRequests />) },
      { path: "external-requests/:id", element: wrap(<ExternalRequestDetail />) },
      { path: "training",    element: wrap(<MyTraining />) },
      { path: "journey",     element: wrap(<MyJourney />) },
      { path: "docs",        element: wrap(<ComingSoon name="Docs & Links" />) },
      {
        path: "admin/users",
        element: wrap(<AdminUsers />),
      },
      {
        path: "admin/training",
        element: wrap(<AdminTraining />),
      },
      {
        path: "admin/permissions",
        element: wrap(<PermissionsIndex />),
      },
      {
        path: "access-restricted",
        element: wrap(<AccessRestricted />),
      },
      {
        path: "*",
        element: wrap(<NotFound />),
      },
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
      { index: true,                              element: wrap(<BeetBoxRedirect />) },
      { path: "work-orders",                      element: wrap(<WorkOrderDashboard />) },
      { path: "work-orders/new",                  element: wrap(<WorkOrderCreate />) },
      { path: "work-orders/:id",                  element: wrap(<WorkOrderDetail />) },
      { path: "inventory",                        element: wrap(<InventoryDashboard />) },
      { path: "inventory/:id",                    element: wrap(<InventoryDetail />) },
      { path: "purchase-orders",                  element: wrap(<PODashboard />) },
      { path: "purchase-orders/new",              element: wrap(<POCreate />) },
      { path: "purchase-orders/:id",              element: wrap(<PODetail />) },
      { path: "tool-calibration",                 element: wrap(<ToolDashboard />) },
      { path: "tool-calibration/:id",             element: wrap(<ToolDetail />) },
      { path: "invoicing",                        element: wrap(<InvoiceDashboard />) },
      { path: "invoicing/:id",                    element: wrap(<InvoiceDetail />) },
      { path: "logbook",                          element: wrap(<LogbookDashboard />) },
      { path: "logbook/:id",                      element: wrap(<LogbookDetail />) },
      { path: "sop-library",                      element: wrap(<SOPDashboard />) },
      { path: "sop-library/:id",                  element: wrap(<SOPDetail />) },
      { path: "training",                         element: wrap(<TrainingDashboard />) },
      { path: "training/:id",                     element: wrap(<TrainingDetail />) },
      { path: "settings",                         element: wrap(<SettingsDashboard />) },
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
      { index: true,           element: wrap(<RecordsVaultRedirect />) },
      { path: "search",        element: wrap(<RecordsVaultSearch />) },
      { path: "browse",        element: wrap(<RecordsVaultBrowse />) },
      { path: "timeline",      element: wrap(<RecordsVaultTimeline />) },
      { path: "pipeline",      element: wrap(<RecordsVaultPipeline />) },
    ],
  },
  {
    path: "*",
    element: wrap(<NotFound />),
  },
]

export const router = createBrowserRouter(routes)
