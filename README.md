# VEYOS Shell v0.3

Reusable itinerary-driven travel companion prototype.

## What changed in v0.3

Transport is now treated as an operational chain of custody rather than a generic itinerary note.

- Every transport leg has an explicit status.
- Every movement can identify **who gets me there**.
- Flights, rail and transfers can carry confirmation/ticket/seat/terminal/gate fields.
- Transport cards can link to authoritative live-status, booking and ticket pages.
- The Journey view shows a transport-readiness summary and unresolved handoffs.
- Today surfaces the active leg's A → B movements before optional travel content.
- Missing information remains visible as `action_required`, `unbooked` or `unknown`.
- Trip Package schema is now v3.
- Service-worker cache stamp bumped so phones receive the new UI.

## Product principle

**AI prepares the trip. VEYOS executes the trip. Local apps perform specialist actions.**

The shell should remain useful offline. Real-time gates, delays, traffic, weather and transit disruptions are enhancements sourced from authoritative providers, not AI dependencies.

## Privacy

The repository is public. Do not commit real trip packages containing booking references, exact business movements, driver information, private contacts, passport/visa data or other sensitive travel details. Import those packages locally on the device.

## Repository history

The original Antigua-specific prototype remains recoverable in Git history. The current repository root is the reusable VEYOS shell.
