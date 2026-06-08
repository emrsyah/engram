import { Loader as LoaderIcon } from "@/features/engram/components/icons";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <LoaderIcon className="animate-spin" />
    </div>
  );
}
