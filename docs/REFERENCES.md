# Layout reference board

Every screen is structured from a real screen on Mobbin. Mobbin decides
structure only: what goes where. Components and styling come from Lime. If a
screen has no good reference here, it does not get built until one is found.

Status: waiting for approval.

## 1. Browse events

| Reference | What we take |
|---|---|
| [Eventbrite event cards](https://mobbin.com/screens/a17e2776-9a71-459c-a4e7-31e9b5180d41) | Card content and order: title, date, venue, "from" price |
| [Codecademy events](https://mobbin.com/screens/bcc2bfc3-2dbd-4351-864e-00dc550c74e1) | Page frame: tabs on top, filter row, count on the right, card grid |

## 2. Event page

| Reference | What we take |
|---|---|
| [Sweatpals event](https://mobbin.com/screens/19e9bbfa-126b-42bb-8075-a08f8cf89237) | Two columns: title, date and venue on the left, media on the right, one price and buy bar |
| [GetYourGuide options](https://mobbin.com/screens/809cd489-7f0a-4dc3-bb8e-ffe31b00fa22) | Sticky summary panel on the right that follows the selection |

## 3. Seat page: one ticket per team (the key screen)

| Reference | What we take |
|---|---|
| [Perplexity Finance predictions](https://mobbin.com/screens/45b26918-4ffb-4e52-84cc-47d90c9a6da2) | Outcome rows: name on the left, percentage and a small change chip on the right |
| [Coinbase Trade](https://mobbin.com/screens/977d160b-6f39-46da-8a8c-5d1bf4f09077) | Rows with price, change and a buy action each, beside a sticky order panel on the right |
| [Binance "Choose a direction"](https://mobbin.com/screens/f47b5b8c-75b9-42ec-a7a7-f75e5d7d5bd2) | The simplest version of the row: three values and one action button |
| [X live game card](https://mobbin.com/screens/c6f41164-e395-47af-af4d-3f70de48fa58) | Header for a game in progress: two teams, the score, the period |

Mobbin has no Polymarket or Kalshi screens. The four above cover the same
structure between them.

## 4. Buy and resell: review before paying

| Reference | What we take |
|---|---|
| [OKX buy preview](https://mobbin.com/screens/81761f94-c587-43d0-be9b-6efa878279fc) | One centered card: the big amount, a "price updates in real time" note, fee rows, one button |

## 5. Live price view

| Reference | What we take |
|---|---|
| [Base asset page](https://mobbin.com/screens/2439249c-3665-4ba4-b7e2-602b39aa8df8) | Big current value with change, chart, time-range pills, then a "your position" card with cost and gain |

## 6. My tickets

| Reference | What we take |
|---|---|
| [Sweatpals purchases](https://mobbin.com/screens/8bd88f4e-6a06-486c-8de9-ac399d3a8364) | Filter chips on top, ticket card with event, date, venue, QR and a manage button |
| [GetYourGuide booking](https://mobbin.com/screens/ffae3d18-f3bd-4625-8f3b-dc1d054e7652) | Ticket detail: event header, then "your tickets" and "manage" action groups on the right |

## 7. Organizer: list an event

| Reference | What we take |
|---|---|
| [Sweatpals create event](https://mobbin.com/screens/43884a8d-3d02-4097-bc25-ba7b7bdde496) | Form on the left, live preview on the right, save draft and publish at the bottom |
| [Calendly new event](https://mobbin.com/screens/9838ae20-0556-4384-928f-e82259b4ec32) | Form split into titled sections, with a summary section first |

## Not found yet

- **Stadium seat map.** The search only returned airplane seat pickers
  ([Kayak](https://mobbin.com/screens/fac0a011-799a-4323-b979-dfc53a5bd616)).
  The frame is usable (map on the left, legend and summary on the right), but
  it is not a stadium. The first build skips the map and names the seat in
  text.
