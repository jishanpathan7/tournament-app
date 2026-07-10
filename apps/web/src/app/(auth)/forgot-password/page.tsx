import { Suspense } from "react";

import { AuthFormShell } from "@/features/marketing/components/auth-form-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Forgot password") };

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthFormShell>
  );
}
