"use client";

import { useState } from "react";
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

const MARKETS = [
  { value: "AFCCHAMP27", label: "AFC Championship Winner" },
  { value: "NFCCHAMP27", label: "NFC Championship Winner" },
  { value: "ALCHAMP26", label: "American League Champion" },
  { value: "NLCHAMP26", label: "National League Champion" },
  { value: "MLSEAST26", label: "MLS Eastern Conference Champion" },
  { value: "MLSWEST26", label: "MLS Western Conference Champion" },
];

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
  const [note, setNote] = useState<string | null>(null);

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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            onClick={() => setNote("Publishing is not connected yet")}
          >
            Publish event
          </Button>
          <Button
            variant="outline"
            onClick={() => setNote("Drafts are not saved yet")}
          >
            Save draft
          </Button>
          {note && <Status status="queued" label={note} />}
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
