import type { ReactNode, HTMLAttributes } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  strong?: boolean;
  glow?: boolean;
  className?: string;
}

export function GlassCard({ children, strong, glow, className = '', ...rest }: GlassCardProps) {
  const base = strong ? 'glass-strong' : 'glass-card';
  const glowClass = glow ? 'campus-glow' : '';
  return (
    <div className={`${base} ${glowClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
