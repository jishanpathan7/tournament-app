"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useLogin } from "@/features/auth/use-auth-actions";
import { type LoginValues, loginSchema } from "@/features/auth/schemas";
import { errorMessage } from "@/lib/problem";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => router.replace(next || "/console"),
      onError: (error) => toast.error(errorMessage(error, "Sign in failed")),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <label className="text-2xs flex items-center gap-2 font-mono uppercase tracking-[0.16em]">
        <input type="checkbox" className="accent-candy h-4 w-4" {...register("rememberMe")} />
        Remember me
      </label>
      <Button type="submit" tone="candy" disabled={login.isPending} className="mt-1 w-full">
        {login.isPending ? <Spinner className="text-white" /> : null}
        Sign in
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        New here?{" "}
        <Link
          href={registerHref}
          className="text-candy-dark font-semibold underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
