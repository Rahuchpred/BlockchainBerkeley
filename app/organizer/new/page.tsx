import Link from "next/link";
import { Button } from "@/components/lime/ui/button";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import { EventForm } from "../../_components/event-form";

export default function NewEventPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <header className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to the organizer page"
            nativeButton={false}
            render={<Link href="/organizer" />}
            icon={<Icon icon={ArrowLeft} size={20} />}
          />
          <div className="flex flex-col gap-2">
            <h1 className="title-page">List an event</h1>
            <p className="max-w-xl text-base leading-normal text-fg-2">
              Sell each seat once per team. You are paid the full seat price,
              whichever team makes the final.
            </p>
          </div>
        </header>
        <EventForm />
      </main>
    </>
  );
}
