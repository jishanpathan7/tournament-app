import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        eyebrow="404"
        title="Page not found"
        description="That page doesn't exist or moved."
        action={
          <Button asChild tone="candy">
            <Link href="/console">Back to console</Link>
          </Button>
        }
      />
    </div>
  );
}
