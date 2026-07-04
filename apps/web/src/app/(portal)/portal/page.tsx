import { PortalHome } from "@/features/portal/components/portal-home";
import { siteTitle } from "@/lib/site";

export const metadata = {
  title: siteTitle("My tournaments"),
};

export default function PortalPage() {
  return <PortalHome />;
}
