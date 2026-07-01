import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata = { title: "Create account · Tournament Platform" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
          Get started
        </p>
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription>Spin up your organization and run your first event.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* RegisterForm reads `next` via useSearchParams — needs a Suspense boundary. */}
        <Suspense>
          <RegisterForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
