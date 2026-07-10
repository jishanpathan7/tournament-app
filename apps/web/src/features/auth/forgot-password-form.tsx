"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useRequestPasswordReset } from "@/features/auth/use-auth-actions";
import { type ForgotPasswordValues, forgotPasswordSchema } from "@/features/auth/schemas";
import { errorMessage } from "@/lib/problem";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const reset = useRequestPasswordReset();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit((values) => {
    reset.mutate(values.email, {
      onSuccess: () => setSent(true),
      onError: (error) => toast.error(errorMessage(error, "Something went wrong")),
    });
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="bg-good/10 text-good flex h-12 w-12 items-center justify-center rounded-full">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-foreground font-semibold">Check your email</p>
          <p className="text-muted-foreground text-sm">
            If <span className="text-foreground font-medium">{getValues("email")}</span> has an
            account, we&apos;ve sent a reset link. It expires in 1 hour.
          </p>
        </div>
        <Link
          href="/login"
          className="text-candy-dark text-sm font-semibold underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>
      <Button type="submit" tone="candy" disabled={reset.isPending} className="w-full">
        {reset.isPending ? <Spinner className="text-white" /> : null}
        Send reset link
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Remember it?{" "}
        <Link
          href="/login"
          className="text-candy-dark font-semibold underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
