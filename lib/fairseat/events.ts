import { EVENTS, type FairEvent } from "./data";
import { listedEvents } from "./store";

// Every event on sale: the ones Fairseat ships with, then the ones organizers have listed.
export const allEvents = (): FairEvent[] => [...EVENTS, ...listedEvents()];

export const findEvent = (id: string) =>
  allEvents().find((event) => event.id === id);
