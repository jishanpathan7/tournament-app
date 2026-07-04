import { Suspense } from "react";

import { AuthFormShell } from "@/features/marketing/components/auth-form-shell";
import { LoginForm } from "@/features/auth/login-form";
import { SITE, siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Sign in") };

export default function LoginPage() {
  return (
    <AuthFormShell
      eyebrow="Welcome back"
      title="Sign in to Playlane"
      description={SITE.authDescription}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFormShell>
  );
}
