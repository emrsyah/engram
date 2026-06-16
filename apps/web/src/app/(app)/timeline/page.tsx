import type { Route } from "next";
import { redirect } from "next/navigation";

export default function TimelinePage() {
  redirect("/tasks" as Route<string>);
}
