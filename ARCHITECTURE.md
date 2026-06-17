# Airport Transfer Booking Architecture

## Core Domain

- `Vehicle`: saloon, executive, 8-seater, VIP, or any custom fleet type.
- `Mileage slab`: editable distance band with `minMiles` and `maxMiles`.
- `Vehicle pricing matrix`: each vehicle stores its own price for every slab.
- `Quote`: calculated from route distance, selected vehicle, date/time, and extra stops.
- `Booking`: confirmed customer journey with frozen quote breakdown.
- `Invoice`: generated from stored booking data so later price changes do not alter old bookings.

## Quote Flow

1. Customer enters pickup, drop-off, optional extra stops, vehicle, and date/time.
2. Server tries Google Directions API when `GOOGLE_MAPS_API_KEY` is available.
3. If no API key is set, manual miles can be entered for testing or dispatcher use.
4. Server selects the matching mileage slab for the selected vehicle.
5. Server adds the configured extra-stop charge.
6. Server applies configured night surcharge when the booking time falls in the night window.
7. Customer confirms and the booking stores the full price breakdown.

## Admin Capabilities

- Add/edit vehicles.
- Activate/deactivate vehicles.
- Edit capacity and luggage.
- Edit every vehicle/slab price without code changes.
- Configure extra-stop pricing as fixed amount or percentage.
- Configure night surcharge percentage.
- View booking/revenue dashboard.
- Open printable invoice from bookings.

## Current Persistence

The MVP stores editable data in `server/data.json`, created automatically from seed data on first API request.

This is intentionally simple for local development. For production, replace `server/data-store.js` with a database repository layer while keeping the pricing API in `server/pricing.js`.

Recommended production database tables:

- `companies`
- `vehicles`
- `mileage_slabs`
- `vehicle_slab_prices`
- `pricing_settings`
- `customers`
- `bookings`
- `booking_stops`
- `invoices`

## Website Integration

The public booking form can be used as a direct link, or embedded in an existing site through an iframe pointed at the booking route. In production, split public booking and admin behind separate routes and protect admin with authentication.

## Production Hardening

- Add admin login and role-based access.
- Add payment provider integration.
- Add email/SMS confirmations.
- Add booking status workflow.
- Replace JSON store with Postgres or MySQL.
- Add server-side validation with a schema library.
- Add rate limiting to quote endpoints.
- Store company logo as an uploaded asset.
- Generate PDF invoices server-side for exact download files.
