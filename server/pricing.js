const METERS_PER_MILE = 1609.344;

export function findSlab(slabs, miles) {
  return slabs.find((slab) => miles >= slab.minMiles && miles <= slab.maxMiles) ?? null;
}

export function isNightBooking(isoDateTime, settings) {
  if (!isoDateTime) return false;
  const local = new Date(isoDateTime);
  if (Number.isNaN(local.getTime())) return false;

  const minutes = local.getHours() * 60 + local.getMinutes();
  const start = timeToMinutes(settings.nightStart);
  const end = timeToMinutes(settings.nightEnd);

  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

export function calculateQuote({ store, vehicleId, distanceMiles, dateTime, extraStops = [], serviceOptions = {} }) {
  const vehicle = store.vehicles.find((candidate) => candidate.id === vehicleId && candidate.active);
  if (!vehicle) {
    throw Object.assign(new Error("Vehicle not found or inactive."), { status: 404 });
  }

  const slab = findSlab(store.slabs, distanceMiles);
  if (!slab) {
    throw Object.assign(new Error("Distance is outside the configured pricing slabs."), { status: 422 });
  }

  const basePrice = Number(vehicle.prices[slab.id] ?? 0);
  if (!basePrice) {
    throw Object.assign(new Error("This vehicle does not have a price for the selected mileage slab."), { status: 422 });
  }

  const stopCount = extraStops.filter(Boolean).length;
  const extraStopTotal =
    store.settings.extraStopMode === "percent"
      ? roundMoney(basePrice * (store.settings.extraStopPercent / 100) * stopCount)
      : roundMoney(store.settings.extraStopFixedAmount * stopCount);

  const nightSurcharge = isNightBooking(dateTime, store.settings)
    ? roundMoney((basePrice + extraStopTotal) * (store.settings.nightSurchargePercent / 100))
    : 0;

  const meetAndGreetTotal = serviceOptions.meetAndGreet ? Number(store.settings.meetAndGreetAmount || 0) : 0;
  const childSeatTotal = roundMoney(Number(serviceOptions.childSeats || 0) * Number(store.settings.childSeatAmount || 0));
  const outboundTotal = roundMoney(basePrice + extraStopTotal + nightSurcharge + meetAndGreetTotal + childSeatTotal);
  const returnTripTotal = serviceOptions.returnTrip
    ? roundMoney(outboundTotal * (1 - Number(store.settings.returnTripDiscountPercent || 0) / 100))
    : 0;
  const total = roundMoney(outboundTotal + returnTripTotal);

  return {
    vehicle,
    distanceMiles: roundMiles(distanceMiles),
    slab,
    currency: store.company.currency,
    breakdown: {
      basePrice,
      extraStopTotal,
      nightSurcharge,
      meetAndGreetTotal,
      childSeatTotal,
      returnTripTotal,
      total
    }
  };
}

export async function calculateRouteDistance({ pickup, dropoff, extraStops = [], googleApiKey }) {
  if (!googleApiKey) return null;

  const stops = extraStops.filter(Boolean);
  const waypointParam = stops.length
    ? `&waypoints=${encodeURIComponent(stops.join("|"))}`
    : "";
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    pickup
  )}&destination=${encodeURIComponent(dropoff)}${waypointParam}&key=${googleApiKey}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not reach distance provider.");
  const body = await response.json();

  if (body.status !== "OK" || !body.routes?.[0]) {
    throw Object.assign(new Error(body.error_message || `Distance provider returned ${body.status}.`), { status: 422 });
  }

  const meters = body.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
  return roundMiles(meters / METERS_PER_MILE);
}

function timeToMinutes(value = "00:00") {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundMiles(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}
