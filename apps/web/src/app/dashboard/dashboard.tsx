"use client";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const { data } = useQuery(trpc.privateData.queryOptions());

  return (
    <>
      <p>API: {data?.message}</p>
    </>
  );
}
