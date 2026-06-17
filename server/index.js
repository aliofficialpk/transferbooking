import express from "express";
import { nanoid } from "nanoid";
import { readStore, writeStore } from "./data-store.js";
import { calculateQuote, calculateRouteDistance } from "./pricing.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json({ limit: "1mb" }));

app.get("/api/config", async (_request, response, next) => {
  try {
    const store = await readStore();
    response.json({
      company: store.company,
      settings: store.settings,
      slabs: store.slabs,
      vehicles: store.vehicles
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/config", async (request, response, next) => {
  try {
    const store = await readStore();
    const nextStore = {
      ...store,
      company: { ...store.company, ...request.body.company },
      settings: { ...store.settings, ...request.body.settings },
      slabs: Array.isArray(request.body.slabs) ? request.body.slabs : store.slabs,
      vehicles: Array.isArray(request.body.vehicles) ? request.body.vehicles : store.vehicles
    };

    await writeStore(nextStore);
    response.json({
      company: nextStore.company,
      settings: nextStore.settings,
      slabs: nextStore.slabs,
      vehicles: nextStore.vehicles
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/quote", async (request, response, next) => {
  try {
    const store = await readStore();
    const {
      pickup,
      dropoff,
      extraStops = [],
      vehicleId,
      dateTime,
      manualDistanceMiles,
      serviceOptions = {}
    } = request.body;

    const routeDistance = await calculateRouteDistance({
      pickup,
      dropoff,
      extraStops,
      googleApiKey: process.env.GOOGLE_MAPS_API_KEY
    });

    const distanceMiles = routeDistance ?? Number(manualDistanceMiles);
    if (!distanceMiles || distanceMiles <= 0) {
      throw Object.assign(new Error("Enter a route distance or configure GOOGLE_MAPS_API_KEY."), { status: 422 });
    }

    const quote = calculateQuote({
      store,
      vehicleId,
      distanceMiles,
      dateTime,
      extraStops,
      serviceOptions
    });

    response.json({
      ...quote,
      distanceSource: routeDistance ? "google-directions" : "manual"
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", async (request, response, next) => {
  try {
    const store = await readStore();
    const quote = calculateQuote({
      store,
      vehicleId: request.body.vehicleId,
      distanceMiles: Number(request.body.distanceMiles),
      dateTime: request.body.dateTime,
      extraStops: request.body.extraStops || [],
      serviceOptions: request.body.serviceOptions || {}
    });

    const booking = {
      id: nanoid(10).toUpperCase(),
      createdAt: new Date().toISOString(),
      status: "confirmed",
      customer: request.body.customer,
      pickup: request.body.pickup,
      dropoff: request.body.dropoff,
      extraStops: request.body.extraStops || [],
      serviceOptions: request.body.serviceOptions || {},
      passengers: Number(request.body.passengers || 1),
      luggage: Number(request.body.luggage || 0),
      flightNumber: request.body.flightNumber || "",
      notes: request.body.notes || "",
      dateTime: request.body.dateTime,
      distanceMiles: quote.distanceMiles,
      vehicleId: quote.vehicle.id,
      vehicleName: quote.vehicle.name,
      quote: quote.breakdown
    };

    store.bookings.unshift(booking);
    await writeStore(store);
    response.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings", async (_request, response, next) => {
  try {
    const store = await readStore();
    response.json(store.bookings);
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings/:id", async (request, response, next) => {
  try {
    const store = await readStore();
    const booking = store.bookings.find((candidate) => candidate.id === request.params.id);
    if (!booking) {
      response.status(404).json({ error: "Booking not found." });
      return;
    }
    response.json({ booking, company: store.company });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    const store = await readStore();
    const totalRevenue = store.bookings.reduce((sum, booking) => sum + booking.quote.total, 0);
    response.json({
      totalBookings: store.bookings.length,
      totalRevenue,
      activeVehicles: store.vehicles.filter((vehicle) => vehicle.active).length,
      latestBookings: store.bookings.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  response.status(error.status || 500).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
