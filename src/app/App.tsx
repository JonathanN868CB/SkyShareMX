import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/features/auth"
import { Toaster } from "@/shared/ui/toaster"
import { Toaster as Sonner } from "@/shared/ui/sonner"
import { router } from "./routes"

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}
