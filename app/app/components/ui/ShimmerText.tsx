"use client";

import { type CSSProperties, type ReactNode } from "react";

export default function ShimmerText({
  children,
  className = "",
  shimmerWidth = 120,
}: {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
}) {
  return (
    <span
      style={
        {
          "--shimmer-w": `${shimmerWidth}px`,
          backgroundSize: "var(--shimmer-w) 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          animation: "shimmer 3s cubic-bezier(0.6,0.6,0,1) infinite",
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgba(13,107,79,0.4) 50%, transparent 100%)",
        } as CSSProperties
      }
      className={className}
    >
      {children}
    </span>
  );
}
