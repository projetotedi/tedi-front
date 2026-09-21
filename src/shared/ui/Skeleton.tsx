import { Skeleton as HeroSkeleton } from "@heroui/react";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <HeroSkeleton aria-hidden className={`motion-reduce:after:hidden ${className}`} />;
}
