"use client";

import { RequireAuth } from "@/features/auth/require-auth";
import { VerifyEmailNotice } from "@/features/auth/verify-email-notice";
import { CreateOrganizationForm } from "@/features/orgs/create-organization-form";

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <VerifyEmailNotice />
      <CreateOrganizationForm />
    </RequireAuth>
  );
}
