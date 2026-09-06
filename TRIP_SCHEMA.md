# VEYOS Trip Package v3

VEYOS is a reusable shell. Each journey is a private JSON package loaded into the shell. Destination-specific behavior is supplied by regional packs rather than hard-coded into the app.

## Product rule

**AI prepares the trip. VEYOS executes the trip. Local apps perform specialist actions.**

The app must answer two operational questions without requiring AI:

1. **What happens next?**
2. **Who is responsible for getting me from A to B?**

## Core objects

- `name`, `travelers`, `startDate`, `endDate`
- `regions[]`: reusable regional knowledge/adapters
  - `services[]`: map, mobility, payment, rail, translation or other local apps/services
  - `readiness[]`: pre-arrival checks such as installing apps or verifying payment setup
  - `guidance[]`: concise cached regional facts that remain useful offline
- `legs[]`: city/country/date range/purpose/stay plus `regionId`
- `itinerary[]`: dated or leg-scoped commitments, optionally with local-language address and external links
- `places[]`: curated contextual places with coordinates/address, category and optional zone
- `transport[]`: operational chain-of-custody records for every movement
- `pocket.quick[]`: addresses, emergency details, useful fixed facts
- `pocket.documents[]`: references/status for passport, visa, tickets, reservations and business material
- `unresolved[]`: travel items that are known to be incomplete
- `preferences`: pace/interests/avoid list used by recommendation logic

## Transport object

Every meaningful movement should be explicit. Do not bury ownership, booking, or live-status details inside itinerary notes.

```json
{
  "id": "pvg-icn",
  "legId": "korea",
  "date": "2026-09-16",
  "from": "PVG",
  "to": "ICN",
  "mode": "Flight",
  "status": "confirmed",
  "responsibleParty": {
    "type": "carrier",
    "organization": "Korean Air"
  },
  "booking": {
    "carrier": "Korean Air",
    "serviceNumber": "KE 882",
    "confirmation": "ABC123",
    "ticketNumber": "180...",
    "seat": "12A",
    "departureTime": "14:20",
    "arrivalTime": "17:15",
    "terminal": "T1",
    "gate": "update live",
    "statusUrl": "https://...",
    "bookingUrl": "https://..."
  },
  "localDestination": "인천국제공항",
  "note": "Keep booking and destination details available offline."
}
```

### `status`

Use one of:

- `confirmed` — traveler has a booked/confirmed movement
- `provider_confirmed` — supplier/company/hotel owns the transfer and has confirmed it
- `action_required` — traveler must still arrange or confirm the movement
- `unbooked` — route choice exists but no booking has been made
- `unknown` — information is incomplete

### `responsibleParty`

The UI surfaces this as **Who gets me there**.

Useful fields:

- `type`: `traveler`, `carrier`, `supplier`, `company`, `hotel`, `driver`, `rail`, etc.
- `name`
- `organization`
- `contact`

### `booking`

Use the fields that apply:

- `carrier`
- `serviceNumber`
- `confirmation`
- `ticketNumber`
- `seat`
- `car`
- `terminal`
- `gate`
- `departureTime`
- `arrivalTime`
- `statusUrl`
- `bookingUrl`
- `ticketUrl`

The shell should never invent missing booking data. Missing confirmation, ticket, gate, terminal, or provider information should remain blank and be represented through `status` / `unresolved[]`.

## Regional adapter rule

A regional pack tells VEYOS which local ecosystem is useful without making VEYOS itself the navigation, taxi, rail or payment platform.

Examples:

- China: AMap + DiDi + payment readiness
- Korea: NAVER Map + k.ride + KORAIL + translation

The PWA stores service catalogs, web fallbacks and App Store links. Exact installed-app deep linking belongs in the native iOS shell where universal-link behavior can be controlled and tested.

## Privacy rule

The public repository contains only the shell and sanitized sample trips. Real trip packages may contain:

- booking references
- ticket numbers
- seats
- hotel locations
- supplier visits
- driver names/numbers
- local contacts

Those packages should remain private and be imported to the device rather than committed to a public repository.

## Offline-first rule

Core execution cannot require AI or a network connection. Trips should be enriched before departure with:

1. hotels, meetings, suppliers and local-language addresses
2. transport chain of custody and responsible party
3. ticket/confirmation data that is safe to store privately
4. planned fallback routes and typical durations
5. curated places and zones
6. regional guidance and readiness checks
7. documents and emergency information

Live traffic, gate changes, delays, cancellations, train changes, weather and business-hours refreshes are optional network enhancements. Their links should be stored in the package so VEYOS can hand off to the authoritative local/carrier source.
