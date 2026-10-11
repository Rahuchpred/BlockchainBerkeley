import { Skeleton } from "@/components/lime/ui/skeleton";

// The stand-in for a page whose route is still resolving.
export function PageSkeleton() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8"
    >
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="w-48" />
      </div>
      <Skeleton shape="block" />
      <Skeleton shape="block" />
    </main>
  );
}
