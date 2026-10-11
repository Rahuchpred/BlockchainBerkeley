import { EventForm } from "../../_components/event-form";

export default function NewEventPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <header className="flex flex-col gap-2">
          <h1 className="title-page">List an event</h1>
          <p className="max-w-xl text-base leading-normal text-fg-2">
            Sell each seat once per team. You are paid the full seat price,
            whichever team makes the final.
          </p>
        </header>
        <EventForm />
      </main>
    </>
  );
}
