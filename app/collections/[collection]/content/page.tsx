import { redirect } from "next/navigation";
import { adminContentListPath } from "@/lib/admin-content-routes";

export default async function CollectionContentPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  redirect(adminContentListPath(collection));
}
