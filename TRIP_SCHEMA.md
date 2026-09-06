# VEYOS Trip Package v3 + Local Overlay Model

VEYOS trip packages remain schema v3. v0.4 adds a separate **local overlay** rather than changing the portable trip schema.

## Baseline package

The imported JSON remains the baseline source. Core objects include `regions[]`, `legs[]`, `itinerary[]`, `transport[]`, `places[]`, `pocket`, `unresolved[]` and `preferences`.

Every itinerary item and transport item should have a stable `id`. VEYOS creates one at import when missing.

## Local overlay

Device-local prep changes are stored separately by trip id:

```json
{
  "transport": {
    "transport-id": {
      "status": "confirmed",
      "responsibleParty": {"type":"driver","name":"Peter","contact":"..."},
      "booking": {"confirmation":"ABC123","seat":"12A","departureTime":"07:40"}
    }
  },
  "itinerary": {
    "event-id": {
      "location": "Supplier site",
      "time": "09:00",
      "endTime": "15:30"
    }
  },
  "addedItinerary": []
}
```

The working trip is `baseline + overlay`. Resetting edits removes only the overlay. Exporting a working trip writes the merged view.

## Derived readiness rules

VEYOS derives prep gaps instead of relying only on a manually authored unresolved list. Examples:

- transport is `action_required`, `unbooked` or `unknown`
- no responsible party is assigned
- confirmed flight has no confirmation number
- provider-owned transfer has no contact or pickup time
- KTX leg is not ticketed
- supplier/work commitment has no usable location
- supplier/work commitment has no start or end time

The gap model is intentionally editable: tapping **Fix** opens the relevant transport or itinerary record.

## Leisure windows

For business travel, leisure is subordinate to travel and work commitments. VEYOS uses timed itinerary items with `endTime` to derive free windows. A business event without an end time is itself a prep gap because the app cannot determine how much leisure time is actually available.

## Privacy rule

Real trip JSON and local overlays can contain booking references, ticket numbers, hotel locations, supplier visits, drivers and local contacts. Keep them private and import them to the device rather than committing them to a public repository.
