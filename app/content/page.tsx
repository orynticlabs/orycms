import { redirect } from "next/navigation";
import { adminContentIndexPath } from "@/admin";

export default function ContentPage() {
  redirect(adminContentIndexPath());
}
