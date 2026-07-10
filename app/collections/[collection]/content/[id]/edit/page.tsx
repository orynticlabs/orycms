import { redirect } from "next/navigation";
import { adminContentEditPath } from "@/lib/admin-content-routes";

export default async function EditContentEntryPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  redirect(adminContentEditPath(collection, id));
}
