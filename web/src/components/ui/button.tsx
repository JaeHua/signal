import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "link"
  size?: "default" | "sm" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-foreground text-background hover:bg-foreground/90",
          variant === "ghost" && "text-foreground hover:bg-muted-bg",
          variant === "outline" && "border border-border bg-transparent hover:bg-muted-bg",
          variant === "link" && "text-accent underline-offset-4 hover:underline",
          size === "default" && "h-9 px-4 py-2",
          size === "sm" && "h-8 px-3 text-xs",
          size === "icon" && "h-9 w-9",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
