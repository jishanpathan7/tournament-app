import Link from "next/link";
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
      <CardContent className="flex flex-col gap-5">
        {/* useSearchParams (next=) requires a Suspense boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-muted-foreground text-center text-sm">
          New here?{" "}
          <Link
            href="/register"
            className="text-candy-dark font-semibold underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
