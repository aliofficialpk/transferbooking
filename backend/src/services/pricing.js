const METERS_PER_MILE = 1609.344;

export function findSlab(slabs, miles) {
  return slabs.find((slab) => miles >= slab.minMiles && miles <= slab.maxMiles) || null;
}

export function isNightBooking(isoDateTime, settings) {
  const timeMatch = String(isoDateTime || "").match(/T(\d{2}):(\d{2})/);
  if (!timeMatch) return false;
  const minutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  const start = timeToMinutes(settings.nightStart);
  const end = timeToMinutes(settings.nightEnd);
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

export function calculateQuote({ config, vehicleId, distanceMiles, dateTime, extraStops = [], serviceOptions = {} }) {
  const vehicle = config.vehicles.find((candidate) => candidate.id === vehicleId && candidate.active);
  if (!vehicle) throw statusError("Vehicle is unavailable.", 404);

  const milesValue = Number(distanceMiles);
  if (!milesValue || milesValue <= 0) throw statusError("Distance is required.", 422);

  const settings = config.settings;
  let basePrice = 0;
  let baseRate = 0;
  let slab = null;

  if (settings.pricingMode === "perMile") {
    const perMileRates = settings.perMileRates || {};
    baseRate = Number(perMileRates[vehicle.id] || 0);
    if (!baseRate) throw statusError("Selected vehicle has no per-mile fare configured.", 422);
    basePrice = money(baseRate * milesValue);
  } else {
    slab = findSlab(config.slabs, milesValue);
    if (!slab) throw statusError("Distance is outside the configured pricing bands.", 422);
    basePrice = Number(vehicle.prices[slab.id] || 0);
    if (!basePrice) throw statusError("Selected vehicle has no fare for this mileage band.", 422);
  }

  const stopCount = (extraStops || []).filter(Boolean).length;
  const extraStopTotal =
    settings.extraStopMode === "percent"
      ? money(basePrice * (Number(settings.extraStopPercent || 0) / 100) * stopCount)
      : money(Number(settings.extraStopFixedAmount || 0) * stopCount);
  const meetAndGreetTotal = serviceOptions.meetAndGreet ? Number(settings.meetAndGreetAmount || 0) : 0;
  const childSeatTotal = money(Number(serviceOptions.childSeats || 0) * Number(settings.childSeatAmount || 0));
  const nightSurcharge = isNightBooking(dateTime, settings)
    ? money((basePrice + extraStopTotal) * (Number(settings.nightSurchargePercent || 0) / 100))
    : 0;
  const outboundTotal = money(basePrice + extraStopTotal + meetAndGreetTotal + childSeatTotal + nightSurcharge);
  const returnTripTotal = serviceOptions.returnTrip
    ? money(outboundTotal * (1 - Number(settings.returnTripDiscountPercent || 0) / 100))
    : 0;
  const subtotal = money(outboundTotal + returnTripTotal);
  const discountTotal = settings.discountEnabled
    ? money(subtotal * (Number(settings.discountPercent || 0) / 100))
    : 0;
  const total = money(Math.max(subtotal - discountTotal, 0));

  return {
    vehicle,
    distanceMiles: miles(milesValue),
    slab,
    currency: config.company.currency,
    breakdown: {
      basePrice,
      baseRate: baseRate || undefined,
      extraStopTotal,
      meetAndGreetTotal,
      childSeatTotal,
      nightSurcharge,
      returnTripTotal,
      discountTotal,
      total
    }
  };
}

export async function calculateRouteDistance({ pickup, dropoff, extraStops = [], googleApiKey }) {
  if (!googleApiKey) return null;
  const waypoints = extraStops.filter(Boolean);
  const waypointParam = waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}` : "";
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${waypointParam}&key=${googleApiKey}`;
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.status !== "OK" || !body.routes?.[0]) {
    throw statusError(body.error_message || "Distance provider could not calculate this route.", 422);
  }
  const meters = body.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
  return miles(meters / METERS_PER_MILE);
}

function statusError(message, status) {
  return Object.assign(new Error(message), { status });
}

function timeToMinutes(value = "00:00") {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function miles(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}
