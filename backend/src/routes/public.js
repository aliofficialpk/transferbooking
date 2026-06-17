import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { query } from "../db/pool.js";
import { getSystemConfig } from "../services/config.js";
import { calculateQuote, calculateRouteDistance } from "../services/pricing.js";

const router = Router();

const quoteSchema = z.object({
  pickup: z.string().min(2),
  dropoff: z.string().min(2),
  extraStops: z.array(z.string()).default([]),
  vehicleId: z.string().min(1),
  dateTime: z.string().min(1),
  manualDistanceMiles: z.union([z.string(), z.number()]).optional(),
  serviceOptions: z.object({
    meetAndGreet: z.boolean().optional(),
    childSeats: z.coerce.number().min(0).optional(),
    returnTrip: z.boolean().optional()
  }).default({})
});

const bookingSchema = quoteSchema.extend({
  distanceMiles: z.coerce.number().positive(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6)
  }),
  passengers: z.coerce.number().min(1).default(1),
  luggage: z.coerce.number().min(0).default(0),
  flightNumber: z.string().optional().default(""),
  notes: z.string().optional().default("")
});

router.get("/config", async (_request, response, next) => {
  try {
    response.json(await getSystemConfig());
  } catch (error) {
    next(error);
  }
});

router.post("/quote", async (request, response, next) => {
  try {
    const payload = quoteSchema.parse(request.body);
    const config = await getSystemConfig();
    const routeDistance = await calculateRouteDistance({
      pickup: payload.pickup,
      dropoff: payload.dropoff,
      extraStops: payload.extraStops,
      googleApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
    const distanceMiles = routeDistance ?? Number(payload.manualDistanceMiles);
    if (!distanceMiles || distanceMiles <= 0) {
      response.status(422).json({ error: "Enter mileage or configure GOOGLE_MAPS_API_KEY on the backend." });
      return;
    }
    response.json({
      ...calculateQuote({ config, ...payload, distanceMiles }),
      distanceSource: routeDistance ? "google-directions" : "manual"
    });
  } catch (error) {
    next(error);
  }
});

router.post("/bookings", async (request, response, next) => {
  try {
    const payload = bookingSchema.parse(request.body);
    const config = await getSystemConfig();
    const quote = calculateQuote({ config, ...payload, distanceMiles: payload.distanceMiles });
    const bookingId = nanoid(10).toUpperCase();
    const invoiceId = nanoid(12).toUpperCase();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${bookingId}`;

    await query(
      `INSERT INTO bookings (
        id, customer_name, customer_email, customer_phone, pickup, dropoff, extra_stops, date_time,
        distance_miles, vehicle_id, vehicle_name, passengers, luggage, flight_number, notes,
        service_options, quote_breakdown
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb)`,
      [
        bookingId,
        payload.customer.name,
        payload.customer.email,
        payload.customer.phone,
        payload.pickup,
        payload.dropoff,
        JSON.stringify(payload.extraStops),
        payload.dateTime,
        quote.distanceMiles,
        quote.vehicle.id,
        quote.vehicle.name,
        payload.passengers,
        payload.luggage,
        payload.flightNumber,
        payload.notes,
        JSON.stringify(payload.serviceOptions),
        JSON.stringify(quote.breakdown)
      ]
    );

    await query(
      `INSERT INTO invoices (id, booking_id, invoice_number, total, currency)
       VALUES ($1, $2, $3, $4, $5)`,
      [invoiceId, bookingId, invoiceNumber, quote.breakdown.total, quote.currency]
    );

    response.status(201).json(await getBookingPayload(bookingId));
  } catch (error) {
    next(error);
  }
});

router.get("/bookings/:id", async (request, response, next) => {
  try {
    const booking = await getBookingPayload(request.params.id);
    if (!booking) {
      response.status(404).json({ error: "Booking not found." });
      return;
    }
    response.json(booking);
  } catch (error) {
    next(error);
  }
});

router.post("/booking-lookup", async (request, response, next) => {
  try {
    const { bookingId, email } = z.object({
      bookingId: z.string().min(6),
      email: z.string().email()
    }).parse(request.body);
    const booking = await getBookingPayload(bookingId.trim().toUpperCase());
    if (!booking || booking.customer.email.toLowerCase() !== email.trim().toLowerCase()) {
      response.status(404).json({ error: "We could not find a booking matching that reference and email." });
      return;
    }
    response.json(booking);
  } catch (error) {
    next(error);
  }
});

router.post("/bookings/:id/cancel", async (request, response, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const bookingId = request.params.id.trim().toUpperCase();
    const booking = await getBookingPayload(bookingId);
    if (!booking || booking.customer.email.toLowerCase() !== email.trim().toLowerCase()) {
      response.status(404).json({ error: "We could not find a booking matching that reference and email." });
      return;
    }
    if (booking.status === "cancelled") {
      response.status(400).json({ error: "This booking has already been cancelled." });
      return;
    }
    await query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [bookingId]);
    response.json(await getBookingPayload(bookingId));
  } catch (error) {
    next(error);
  }
});

async function getBookingPayload(id) {
  const result = await query(
    `SELECT b.*, i.invoice_number, i.currency
     FROM bookings b
     LEFT JOIN invoices i ON i.booking_id = b.id
     WHERE b.id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    pickup: row.pickup,
    dropoff: row.dropoff,
    extraStops: row.extra_stops,
    dateTime: row.date_time,
    distanceMiles: Number(row.distance_miles),
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    passengers: row.passengers,
    luggage: row.luggage,
    flightNumber: row.flight_number,
    notes: row.notes,
    serviceOptions: row.service_options,
    quote: row.quote_breakdown,
    currency: row.currency,
    createdAt: row.created_at
  };
}

export { getBookingPayload };
export default router;
