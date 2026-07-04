import { VerifyEmailConfirmation } from "@/features/auth/verify-email-confirmation";
import { siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Verify email") };

export default function VerifyEmailPage() {
  return <VerifyEmailConfirmation />;
}
