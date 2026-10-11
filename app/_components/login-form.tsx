"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { logIn } from "../actions";

// Demo login: the username alone opens the account. There is no password to ask for.
export function LoginForm({ hint }: { hint: string }) {
  const [username, setUsername] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError(null);
          const result = await logIn(username);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <Field name="username">
        <FieldLabel>Username</FieldLabel>
        <Input
          size="lg"
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setUsername(event.target.value)}
        />
        <FieldDescription>{hint}</FieldDescription>
      </Field>
      {error && (
        <p role="alert" className="text-sm leading-normal text-danger-text">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        pending={pending}
        disabled={username.trim() === ""}
      >
        Log in
      </Button>
    </form>
  );
}
