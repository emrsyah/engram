import type { Route } from "next";
import { redirect } from "next/navigation";

export default function CanvasPage() {
  redirect("/tasks" as Route<string>);
}
