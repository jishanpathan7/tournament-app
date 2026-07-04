import { LandingRedirect } from "@/features/marketing/components/landing-redirect";

/** Entry point — marketing landing for guests; authenticated users redirect to console. */
export default function RootPage() {
  return <LandingRedirect />;
}
