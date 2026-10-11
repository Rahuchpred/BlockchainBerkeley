"use client";

import { useTransition } from "react";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/lime/ui/select";
import { chooseTeam } from "../actions";

export type TeamGroup = {
  name: string;
  teams: { value: string; label: string }[];
};

// The team this browser organizes for. Each team has its own organizer wallet.
export function TeamPicker({
  team,
  groups,
}: {
  team: string;
  groups: TeamGroup[];
}) {
  const [pending, start] = useTransition();
  const items = groups.flatMap((group) => group.teams);

  return (
    <Field name="team" className="w-full sm:w-64">
      <FieldLabel>Team you organize for</FieldLabel>
      <Select
        items={items}
        value={team}
        disabled={pending}
        onValueChange={(value) => {
          if (value) start(() => chooseTeam(value));
        }}
      >
        <SelectTrigger className="w-full" />
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.name}>
              <SelectLabel>{group.name}</SelectLabel>
              {group.teams.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
