// This page is no longer used — Records Vault is now a full-screen module at /app/records-vault
// Routing is handled in src/app/routes.tsx via RecordsVaultApp
import { Navigate } from "react-router-dom"
export default function RecordsVault() {
  return <Navigate to="/app/records-vault" replace />
}
