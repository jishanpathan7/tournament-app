import Link from "next/link";

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
      <CardContent className="flex flex-col gap-5">
        <RegisterForm />
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-candy-dark font-semibold underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
