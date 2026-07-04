import type { Metadata } from "next";

import { PublicSearchPage } from "@/features/public/components/public-search-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Find a tournament",
  description: `Search public tournaments on ${SITE.name}.`,
};

export default function SearchPage() {
  return <PublicSearchPage />;
}
