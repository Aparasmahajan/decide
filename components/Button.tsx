"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  glow?: boolean;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-white/95 to-white/80 text-ink-950 hover:from-white hover:to-white/90",
  secondary:
    "bg-white/5 text-white/90 hover:bg-white/10 border border-white/10",
  ghost:
    "bg-transparent text-white/80 hover:bg-white/5 border border-transparent",
  danger:
    "bg-red-500/10 text-red-200 hover:bg-red-500/20 border border-red-500/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-11 px-5 text-[15px] rounded-2xl",
  lg: "h-14 px-8 text-base rounded-2xl",
};

const MotionButton = motion.button;

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", glow, className, children, ...rest },
  ref,
) {
  return (
    <MotionButton
      ref={ref}
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-colors",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_20px_40px_-20px_rgba(0,0,0,0.6)]",
        "select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        glow && "shadow-glow",
        className,
      )}
      {...(rest as React.ComponentProps<typeof MotionButton>)}
    >
      {variant === "primary" && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%)",
            mixBlendMode: "overlay",
          }}
        />
      )}
      <span className="relative">{children}</span>
    </MotionButton>
  );
});

export default Button;
