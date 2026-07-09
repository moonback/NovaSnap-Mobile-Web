import React from 'react';

interface SkeletonProps {
  className?: string;
  key?: React.Key;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-xl bg-black/10 dark:bg-white/10 ${className}`} aria-hidden="true" />;
}
