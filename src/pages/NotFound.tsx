import { Link } from "react-router-dom"
import { Button } from "@/shared/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
        <Button asChild variant="outline">
          <Link to="/app">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
