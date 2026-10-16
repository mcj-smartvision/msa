/**
 * @file shared/components/ui/skeleton.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (skeleton)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/utils
 */

import { cn } from '@/shared/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
export { Skeleton }
