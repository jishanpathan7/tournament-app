import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function ConsoleNotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        eyebrow="404"
        title="Page not found"
        description="This page doesn't exist or you don't have access to it."
        action={
          <Button asChild tone="candy">
            <Link href="/console">Back to console</Link>
          </Button>
        }
      />
    </div>
  );
}
