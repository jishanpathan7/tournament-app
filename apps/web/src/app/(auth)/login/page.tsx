import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Sign in · Tournament Platform" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
          Welcome back
        </p>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Manage your tournaments and live scoring.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* LoginForm reads `next` via useSearchParams — needs a Suspense boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
