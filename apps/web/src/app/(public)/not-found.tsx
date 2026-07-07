import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function PublicNotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        eyebrow="404"
        title="Tournament not found"
        description="That tournament doesn't exist or hasn't been made public yet."
        action={
          <Button asChild tone="paper">
            <Link href="/search">Browse tournaments</Link>
          </Button>
        }
      />
    </div>
  );
}
