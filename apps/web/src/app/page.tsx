import { redirect } from "next/navigation";

/** Entry point → the console. Unauthenticated users are bounced to /login by the guard. */
export default function RootPage() {
  redirect("/console");
}
