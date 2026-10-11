import { BUYER_NAME, HOUSE_NAME } from "@/lib/fairseat/data";
import { LoginForm } from "../_components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">Log in</h1>
        <p className="text-base leading-normal text-fg-2">
          Each account sees only its own side of Fairseat. This is a demo, so a
          username is all it takes.
        </p>
      </header>
      <LoginForm
        hint={`${BUYER_NAME} to buy tickets. An NBA team's code, such as GSW or LAL, to organize for that team. ${HOUSE_NAME} to run the other events.`}
      />
    </main>
  );
}
