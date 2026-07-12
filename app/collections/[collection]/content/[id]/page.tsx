import { redirect } from "next/navigation";
import { adminContentEditPath } from "@/admin";

export default async function EditContentEntryPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  redirect(adminContentEditPath(collection, id));
}
