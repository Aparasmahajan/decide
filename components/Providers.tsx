"use client";

import { MotionConfig } from "framer-motion";

/**
 * `reducedMotion="user"` makes every framer-motion component honour the OS
 * "reduce motion" setting (transform/layout animations are skipped, opacity
 * still fades). The global CSS rule in globals.css only covers CSS animations.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
