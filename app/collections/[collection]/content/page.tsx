import { redirect } from "next/navigation";
import { adminContentListPath } from "@/admin";

export default async function CollectionContentPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  redirect(adminContentListPath(collection));
}
