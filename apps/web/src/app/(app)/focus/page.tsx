import type { Route } from "next";
import { redirect } from "next/navigation";

export default function FocusPage() {
  redirect("/tasks" as Route<string>);
}
