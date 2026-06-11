import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-4 text-sm text-foreground shadow-none outline-none transition-[border-color,background] duration-150 ease-out placeholder:text-muted-foreground focus:border-primary/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-primary/20",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
