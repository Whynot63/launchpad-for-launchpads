import { CreateLaunchpadForm } from "@/components/CreateLaunchpadForm";
import { slugFromName } from "@/lib/metadata";

export default async function CreateLaunchpadPage({ searchParams }: PageProps<"/create">) {
  const { slug } = await searchParams;
  return <CreateLaunchpadForm initialSlug={typeof slug === "string" ? slugFromName(slug) : ""} />;
}
