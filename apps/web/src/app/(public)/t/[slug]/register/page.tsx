import { PublicRegisterForm } from "@/features/public/components/public-register-form";

export default async function PublicRegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicRegisterForm slug={slug} />;
}
