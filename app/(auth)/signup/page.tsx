/**
 * @file app/(auth)/signup/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on nothing
 */

import { redirect } from 'next/navigation'

export default function SignupPage() {
  redirect('/login')
}
