import "dotenv/config";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "url";
import { pool, query } from "./pool.js";

const slabs = [
  ["0-10", "0-10 miles", 0, 10],
  ["11-15", "11-15 miles", 10.01, 15],
  ["16-20", "16-20 miles", 15.01, 20],
  ["21-25", "21-25 miles", 20.01, 25],
  ["26-40", "26-40 miles", 25.01, 40],
  ["41-50", "40-50 miles", 40.01, 50],
  ["51-80", "50-80 miles", 50.01, 80],
  ["81-100", "80-100 miles", 80.01, 100],
  ["101-150", "100-150 miles", 100.01, 150]
];

const vehicles = [
  {
    id: "saloon",
    name: "Saloon",
    category: "Saloon",
    capacity: 3,
    luggage: 2,
    description: "Comfortable airport transfer with a private saloon car.",
    prices: [38, 48, 58, 70, 92, 112, 155, 195, 270]
  },
  {
    id: "executive",
    name: "Executive",
    category: "Executive",
    capacity: 3,
    luggage: 2,
    description: "Premium executive car for long-distance airport transfers.",
    prices: [55, 70, 84, 98, 132, 158, 220, 270, 380]
  },
  {
    id: "people-carrier",
    name: "People Carrier",
    category: "People Carrier",
    capacity: 6,
    luggage: 6,
    description: "Flexible family transfer with space for passengers and luggage.",
    prices: [70, 88, 105, 124, 160, 195, 270, 330, 465]
  },
  {
    id: "mpv",
    name: "MPV",
    category: "MPV",
    capacity: 7,
    luggage: 7,
    description: "Spacious multi-purpose vehicle for larger groups.",
    prices: [78, 96, 116, 138, 178, 215, 295, 360, 510]
  }
];

const defaultCompany = {
  name: "Premier Chauffeur Transfers",
  logoUrl: "",
  email: "bookings@example.com",
  phone: "+44 20 0000 0000",
  currency: "GBP",
  address: "London Heathrow, Hounslow, United Kingdom"
};

const defaultPricing = {
  pricingMode: "slab",
  perMileRates: {
    saloon: 1.99
  },
  longDistanceThresholdMiles: 100,
  longDistanceRates: {
    executive: 2.19,
    "people-carrier": 2.49,
    mpv: 2.99
  },
  extraStopMode: "fixed",
  extraStopFixedAmount: 12,
  extraStopPercent: 8,
  nightSurchargePercent: 10,
  nightStart: "22:00",
  nightEnd: "06:00",
  meetAndGreetAmount: 20,
  childSeatAmount: 8,
  returnTripDiscountPercent: 8
};

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      company JSONB NOT NULL,
      pricing JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mileage_slabs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      min_miles NUMERIC(8,2) NOT NULL,
      max_miles NUMERIC(8,2) NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      luggage INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicle_prices (
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      slab_id TEXT NOT NULL REFERENCES mileage_slabs(id) ON DELETE CASCADE,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (vehicle_id, slab_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'confirmed',
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      pickup TEXT NOT NULL,
      dropoff TEXT NOT NULL,
      extra_stops JSONB NOT NULL DEFAULT '[]'::jsonb,
      date_time TIMESTAMPTZ NOT NULL,
      distance_miles NUMERIC(8,2) NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_name TEXT NOT NULL,
      passengers INTEGER NOT NULL DEFAULT 1,
      luggage INTEGER NOT NULL DEFAULT 0,
      flight_number TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      service_options JSONB NOT NULL DEFAULT '{}'::jsonb,
      quote_breakdown JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      invoice_number TEXT UNIQUE NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(
    `INSERT INTO app_settings (id, company, pricing)
     VALUES (1, $1::jsonb, $2::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(defaultCompany), JSON.stringify(defaultPricing)]
  );

  for (const [id, label, minMiles, maxMiles] of slabs) {
    await query(
      `INSERT INTO mileage_slabs (id, label, min_miles, max_miles, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, min_miles = EXCLUDED.min_miles, max_miles = EXCLUDED.max_miles, sort_order = EXCLUDED.sort_order`,
      [id, label, minMiles, maxMiles, slabs.findIndex((slab) => slab[0] === id)]
    );
  }

  for (const vehicle of vehicles) {
    await query(
      `INSERT INTO vehicles (id, name, category, capacity, luggage, description, active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [vehicle.id, vehicle.name, vehicle.category, vehicle.capacity, vehicle.luggage, vehicle.description]
    );

    for (const [index, slab] of slabs.entries()) {
      await query(
        `INSERT INTO vehicle_prices (vehicle_id, slab_id, price)
         VALUES ($1, $2, $3)
         ON CONFLICT (vehicle_id, slab_id) DO NOTHING`,
        [vehicle.id, slab[0], vehicle.prices[index]]
      );
    }
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash]
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate()
    .then(async () => {
      console.log("Database migration complete.");
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
