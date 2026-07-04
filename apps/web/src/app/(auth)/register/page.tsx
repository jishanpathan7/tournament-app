import { Suspense } from "react";

import { AuthFormShell } from "@/features/marketing/components/auth-form-shell";
import { RegisterForm } from "@/features/auth/register-form";
import { siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Create account") };

export default function RegisterPage() {
  return (
    <AuthFormShell
      eyebrow="Get started"
      title="Create account"
      description="Spin up your organization and run your first event on Playlane."
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthFormShell>
  );
}
