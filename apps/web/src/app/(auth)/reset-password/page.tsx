import { Suspense } from "react";

import { AuthFormShell } from "@/features/marketing/components/auth-form-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Reset password") };

export default function ResetPasswordPage() {
  return (
    <AuthFormShell
      eyebrow="New password"
      title="Choose a new password"
      description="Pick something strong — at least 8 characters."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthFormShell>
  );
}
