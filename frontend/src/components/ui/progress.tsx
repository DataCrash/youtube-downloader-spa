import { cn } from '@/lib/utils'

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  const bounded = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
      role="progressbar"
    >
      <div className="h-full bg-primary transition-all" style={{ width: `${bounded}%` }} />
    </div>
  )
}
