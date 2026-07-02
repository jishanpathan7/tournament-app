import type { Metadata } from "next";

import { PublicSearchPage } from "@/features/public/components/public-search-page";

export const metadata: Metadata = {
  title: "Find a tournament",
  description: "Search public tournaments on Tournament Platform.",
};

export default function SearchPage() {
  return <PublicSearchPage />;
}
