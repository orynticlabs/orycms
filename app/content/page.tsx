import { redirect } from "next/navigation";
import { adminContentIndexPath } from "@/lib/admin-content-routes";

export default function ContentPage() {
  redirect(adminContentIndexPath());
}
