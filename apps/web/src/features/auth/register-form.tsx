"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { type RegisterValues, registerSchema } from "@/features/auth/schemas";
import { useRegister } from "@/features/auth/use-auth-actions";
import { errorMessage } from "@/lib/problem";

export function RegisterForm() {
  const router = useRouter();
  const registerMut = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    registerMut.mutate(values, {
      // New accounts have no org yet — route to org onboarding.
      onSuccess: () => router.replace("/console"),
      onError: (error) => toast.error(errorMessage(error, "Could not create account")),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        helper="At least 8 characters"
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <Button type="submit" tone="candy" disabled={registerMut.isPending} className="mt-1 w-full">
        {registerMut.isPending ? <Spinner className="text-white" /> : null}
        Create account
      </Button>
    </form>
  );
}
