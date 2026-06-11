import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold tabular-nums",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.06] text-foreground",
        perfect: "border-emerald-300/25 bg-emerald-300/12 text-emerald-100",
        close: "border-cyan-300/25 bg-cyan-300/12 text-cyan-100",
        warning: "border-amber-300/25 bg-amber-300/12 text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
