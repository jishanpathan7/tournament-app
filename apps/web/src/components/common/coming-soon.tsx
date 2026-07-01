import { Hammer, type LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";

/**
 * Standard scaffold for a route whose screen isn't built yet — every future screen
 * replaces one of these with real content, keeping the shell fully navigable meanwhile.
 */
export function ComingSoon({
  eyebrow,
  title,
  description,
  icon = Hammer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="p-2">
        <EmptyState
          icon={icon}
          eyebrow="Coming soon"
          title="This screen is on the way"
          description="The foundation is in place — this surface will be built on top of it next."
        />
      </Card>
    </div>
  );
}
