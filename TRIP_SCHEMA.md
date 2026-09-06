# VEYOS Trip Package v2

VEYOS is a reusable shell. Each journey is a JSON package loaded into the shell. Destination-specific behavior is supplied by regional packs rather than hard-coded into the app.

## Core objects

- `name`, `travelers`, `startDate`, `endDate`
- `regions[]`: reusable regional knowledge/adapters
  - `services[]`: map, mobility, payment, translation or other local apps/services
  - `readiness[]`: pre-arrival checks such as installing apps or verifying payment setup
  - `guidance[]`: concise cached regional facts that remain useful offline
- `legs[]`: city/country/date range/purpose/stay plus `regionId`
- `itinerary[]`: dated or leg-scoped commitments, optionally with local-language address and external links
- `places[]`: curated contextual places with coordinates/address, category and optional zone
- `transport[]`: preplanned movement between known trip places with mode, typical duration, local destination card and fallbacks
- `pocket.quick[]`: addresses, emergency details, useful fixed facts
- `pocket.documents[]`: references/status for passport, visa, tickets, reservations and business material
- `preferences`: pace/interests/avoid list used by recommendation logic

## Regional adapter rule

A regional pack tells VEYOS which local ecosystem is useful without making VEYOS itself the navigation, taxi or payment platform.

Example:

- China: AMap + DiDi + payment readiness
- Korea: NAVER Map + k.ride

The PWA stores service catalog, web fallbacks and App Store links. Exact installed-app deep linking should be implemented in the native iOS shell where `canOpenURL`/universal-link behavior can be controlled and tested.

## Offline-first rule

Core execution cannot require AI or a network connection. Trips should be enriched before departure with:

1. hotels, meetings, suppliers and local-language addresses
2. planned transport legs and typical duration ranges
3. curated places and zones
4. regional guidance and readiness checks
5. documents and emergency information

Live weather, traffic, flight status and business-hours refreshes are optional enhancements.
