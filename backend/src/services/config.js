import { query } from "../db/pool.js";

export async function getSystemConfig({ includeInactive = false } = {}) {
  const [settingsResult, slabsResult, vehiclesResult] = await Promise.all([
    query("SELECT company, pricing FROM app_settings WHERE id = 1"),
    query("SELECT id, label, min_miles, max_miles FROM mileage_slabs ORDER BY sort_order ASC"),
    query(
      `SELECT v.*, COALESCE(jsonb_object_agg(vp.slab_id, vp.price) FILTER (WHERE vp.slab_id IS NOT NULL), '{}'::jsonb) AS prices
       FROM vehicles v
       LEFT JOIN vehicle_prices vp ON vp.vehicle_id = v.id
       ${includeInactive ? "" : "WHERE v.active = TRUE"}
       GROUP BY v.id
       ORDER BY v.created_at ASC`
    )
  ]);

  const settings = settingsResult.rows[0];
  return {
    company: settings.company,
    settings: settings.pricing,
    slabs: slabsResult.rows.map((slab) => ({
      id: slab.id,
      label: slab.label,
      minMiles: Number(slab.min_miles),
      maxMiles: Number(slab.max_miles)
    })),
    vehicles: vehiclesResult.rows.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      category: vehicle.category,
      capacity: vehicle.capacity,
      luggage: vehicle.luggage,
      description: vehicle.description,
      active: vehicle.active,
      prices: normalizePrices(vehicle.prices)
    }))
  };
}

export async function saveSystemConfig(payload) {
  const client = await query("SELECT 1");
  void client;
}

function normalizePrices(prices) {
  return Object.fromEntries(Object.entries(prices || {}).map(([key, value]) => [key, Number(value)]));
}
