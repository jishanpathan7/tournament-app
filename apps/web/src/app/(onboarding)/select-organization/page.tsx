"use client";

import { RequireAuth } from "@/features/auth/require-auth";
import { OrganizationSelector } from "@/features/orgs/organization-selector";

export default function SelectOrganizationPage() {
  return (
    <RequireAuth>
      <OrganizationSelector />
    </RequireAuth>
  );
}
