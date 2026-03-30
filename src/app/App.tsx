import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/features/auth"
import { Toaster } from "@/shared/ui/toaster"
import { Toaster as Sonner } from "@/shared/ui/sonner"
import { router } from "./routes"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Toaster />
          <Sonner />
<RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
