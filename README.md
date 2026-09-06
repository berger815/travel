# VEYOS Shell v0.2

Reusable itinerary-driven travel companion prototype.

## What changed from v0.1

- Regional packs are first-class data.
- Each leg can activate a regional toolkit automatically.
- Regional services (maps, ride-hailing, etc.) have web/App Store fallbacks.
- Pre-trip readiness checks persist locally per region.
- Planned transport is modeled separately from itinerary commitments.
- Local-language destination cards are supported throughout.
- Explore can surface both Apple Maps and the current region's preferred mapping service.

## Product principle

**AI prepares the trip. VEYOS executes the trip. Local apps perform specialist actions.**

The shell should remain useful offline. Real-time AI, traffic, weather and flight data are enhancements, not dependencies.

## Repository migration

The original Antigua-specific prototype is deprecated. It remains recoverable in Git history; the repository root now represents the reusable VEYOS shell and itinerary-driven trip packages.
