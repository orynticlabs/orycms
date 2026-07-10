import { redirect } from "next/navigation";
import { adminContentCreatePath } from "@/lib/admin-content-routes";

export default async function NewContentEntryPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  redirect(adminContentCreatePath(collection));
}
