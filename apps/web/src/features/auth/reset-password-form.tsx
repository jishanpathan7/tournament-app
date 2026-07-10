"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useConfirmPasswordReset } from "@/features/auth/use-auth-actions";
import { type ResetPasswordValues, resetPasswordSchema } from "@/features/auth/schemas";
import { errorMessage } from "@/lib/problem";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();
  const confirm = useConfirmPasswordReset();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="bg-pink/10 text-pink flex h-12 w-12 items-center justify-center rounded-full">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-foreground font-semibold">Invalid reset link</p>
          <p className="text-muted-foreground text-sm">
            This link is missing its token. Request a new one.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="text-candy-dark text-sm font-semibold underline-offset-2 hover:underline"
        >
          Request new link
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit((values) => {
    confirm.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success("Password updated — please sign in");
          router.replace("/login");
        },
        onError: (error) => {
          const msg = errorMessage(error, "Reset failed");
          toast.error(
            msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")
              ? "This link has expired. Request a new one."
              : msg,
          );
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="New password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" tone="candy" disabled={confirm.isPending} className="w-full">
        {confirm.isPending ? <Spinner className="text-white" /> : null}
        Set new password
      </Button>
    </form>
  );
}
