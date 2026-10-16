/**
 * @file shared/components/ui/label.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (label)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/utils
 */

import * as React from 'react'
import { cn } from '@/shared/lib/utils'

const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<'label'>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
