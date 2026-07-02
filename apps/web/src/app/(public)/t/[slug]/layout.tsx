import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicTournamentProvider } from "@/features/public/components/public-tournament-provider";
import { PublicTopNav } from "@/features/public/components/public-top-nav";
import { getTournament, PublicApiError } from "@/features/public/public-api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tournament = await getTournament(slug);
    return {
      title: `${tournament.name} · ${tournament.organization.name}`,
      description: `Live bracket, fixtures, and standings for ${tournament.name}, hosted by ${tournament.organization.name}.`,
    };
  } catch {
    return { title: "Tournament" };
  }
}

export default async function PublicTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let tournament;
  try {
    tournament = await getTournament(slug);
  } catch (error) {
    if (error instanceof PublicApiError && error.isNotFound) notFound();
    throw error;
  }

  return (
    <PublicTournamentProvider slug={slug} initialTournament={tournament}>
      <div className="min-h-screen">
        <PublicTopNav slug={slug} tournament={tournament} />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </PublicTournamentProvider>
  );
}
