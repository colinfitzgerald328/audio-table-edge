import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "sm" | "lg"
}

const sizeClasses = {
  default: "h-6 w-6",
  sm: "h-4 w-4",
  lg: "h-8 w-8",
}

export function Spinner({ size = "default", className, ...props }: SpinnerProps) {
  return (
    <div role="status" {...props}>
      <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
