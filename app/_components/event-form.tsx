"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/lime/ui/select";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import { MARKETS as MARKET_INFO } from "@/lib/fairseat/data";
import type { Check } from "@/lib/fairseat/context";
import { publishEvent, type PublishResult } from "../actions";

const MARKETS = Object.entries(MARKET_INFO).map(([value, info]) => ({
  value,
  label: info.label,
}));

const FIELD: Record<Check["field"], string> = {
  name: "Name",
  date: "Date",
  venue: "Venue",
};

const marketLabel = (value: string | null) =>
  MARKETS.find((market) => market.value === value)?.label;

export function EventForm() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [link, setLink] = useState("");
  const [market, setMarket] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [pending, start] = useTransition();

  const fullPrice = Number(price);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <form
        className="flex flex-col gap-8 lg:col-span-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <section className="flex max-w-md flex-col gap-4">
          <h2 className="text-lg font-semibold">Event details</h2>
          <Field name="name">
            <FieldLabel>Event name</FieldLabel>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field name="date">
            <FieldLabel>Date</FieldLabel>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field name="venue">
            <FieldLabel>Venue</FieldLabel>
            <Input
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
            />
          </Field>
          <Field name="link">
            <FieldLabel>Official event page</FieldLabel>
            <Input
              type="url"
              inputMode="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <FieldDescription>
              We check this page against the name, date and venue before the
              event goes on sale.
            </FieldDescription>
          </Field>
        </section>

        <section className="flex max-w-md flex-col gap-4">
          <h2 className="text-lg font-semibold">Pricing</h2>
          <Field name="market">
            <FieldLabel>Gemini market</FieldLabel>
            <Select items={MARKETS} value={market} onValueChange={setMarket}>
              <SelectTrigger placeholder="Choose a market" className="w-full" />
              <SelectContent>
                {MARKETS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Each team in this market gets its own ticket for every seat,
              priced by its odds.
            </FieldDescription>
          </Field>
          <Field name="section">
            <FieldLabel>Section</FieldLabel>
            <Input
              value={section}
              onChange={(event) => setSection(event.target.value)}
            />
          </Field>
          <Field name="price">
            <FieldLabel>Full seat price in dollars</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
        </section>

        <div className="flex max-w-md flex-col gap-3">
          <div>
            <Button
              type="submit"
              pending={pending}
              onClick={() =>
                start(async () => {
                  setResult(null);
                  setResult(
                    await publishEvent({
                      name,
                      date,
                      venue,
                      link,
                      market: market ?? "",
                      section,
                      price: fullPrice,
                    }),
                  );
                })
              }
            >
              Check and publish
            </Button>
          </div>
          {pending && (
            <p className="text-sm leading-normal text-fg-2">
              Reading the official page with Context.dev. This takes a few
              seconds.
            </p>
          )}
          {result && "error" in result && (
            <p role="alert" className="text-sm leading-normal text-danger-text">
              {result.error}
            </p>
          )}
          {result && "checks" in result && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {result.eventId ? "Checked and on sale" : "Not published"}
              </h2>
              <p className="text-sm leading-normal text-fg-2">
                {result.eventId
                  ? "Every detail matches, and nothing else on the web says otherwise."
                  : "Something does not match. Fix the details and check again."}
              </p>
              <h3 className="text-base font-medium">{`The page at ${result.page}`}</h3>
              <ul className="flex flex-col gap-2">
                {result.checks.map((check) => (
                  <li key={check.field}>
                    <Status
                      status={check.ok ? "done" : "failed"}
                      label={`${FIELD[check.field]}: the page says ${check.found ?? "nothing about it"}`}
                    />
                  </li>
                ))}
                <li>
                  <Status
                    status={result.owner ? "done" : "queued"}
                    label={
                      result.owner
                        ? `Site run by ${result.owner}`
                        : "We could not tell who runs this site"
                    }
                  />
                </li>
              </ul>
              <h3 className="text-base font-medium">
                A separate search of the web
              </h3>
              <p className="text-sm leading-normal text-fg-2">
                Done without the page above, so a made-up page cannot fool it.
              </p>
              <ul className="flex flex-col gap-2">
                {result.independent.map((check) => (
                  <li key={check.field}>
                    <Status
                      status={
                        check.ok === null
                          ? "queued"
                          : check.ok
                            ? "done"
                            : "failed"
                      }
                      label={
                        check.found
                          ? `${FIELD[check.field]}: other sources say ${check.found}`
                          : `${FIELD[check.field]}: other sources do not say`
                      }
                    />
                  </li>
                ))}
              </ul>
              {result.eventId && (
                <div>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/events/${result.eventId}`} />}
                  >
                    View the event
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      </form>

      <aside className="lg:col-span-1">
        <section className="flex flex-col gap-3 lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Preview</h2>
          <Card variant="surface">
            <div className="flex flex-col gap-1">
              <CardTitle>{name || "Event name"}</CardTitle>
              <CardDescription>{date || "Date"}</CardDescription>
              <CardDescription>{venue || "Venue"}</CardDescription>
            </div>
            <p className="text-sm text-fg-2">
              {marketLabel(market) ?? "No market chosen"}
              {section ? `, section ${section}` : ""}
            </p>
            <p className="text-sm text-fg-2">
              {fullPrice > 0
                ? `Full seat price ${formatAmount(fullPrice)}`
                : "No seat price yet"}
            </p>
          </Card>
        </section>
      </aside>
    </div>
  );
}
