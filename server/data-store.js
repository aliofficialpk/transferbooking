import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data.json");

const defaultSlabs = [
  { id: "0-10", minMiles: 0, maxMiles: 10 },
  { id: "11-15", minMiles: 10.01, maxMiles: 15 },
  { id: "16-20", minMiles: 15.01, maxMiles: 20 },
  { id: "21-25", minMiles: 20.01, maxMiles: 25 },
  { id: "26-40", minMiles: 25.01, maxMiles: 40 },
  { id: "41-50", minMiles: 40.01, maxMiles: 50 },
  { id: "51-80", minMiles: 50.01, maxMiles: 80 },
  { id: "81-100", minMiles: 80.01, maxMiles: 100 },
  { id: "101-150", minMiles: 100.01, maxMiles: 150 }
];

const seed = {
  company: {
    name: "Premier Chauffeur Transfers",
    logoUrl: "",
    email: "bookings@example.com",
    phone: "+44 20 0000 0000",
    currency: "GBP"
  },
  settings: {
    extraStopMode: "fixed",
    extraStopFixedAmount: 10,
    extraStopPercent: 8,
    nightSurchargePercent: 10,
    nightStart: "22:00",
    nightEnd: "06:00",
    meetAndGreetAmount: 18,
    childSeatAmount: 7,
    returnTripDiscountPercent: 8
  },
  slabs: defaultSlabs,
  vehicles: [
    {
      id: "saloon",
      name: "Saloon",
      capacity: 3,
      luggage: 2,
      active: true,
      prices: {
        "0-10": 35,
        "11-15": 45,
        "16-20": 55,
        "21-25": 65,
        "26-40": 85,
        "41-50": 105,
        "51-80": 145,
        "81-100": 180,
        "101-150": 250
      }
    },
    {
      id: "executive",
      name: "Executive",
      capacity: 3,
      luggage: 2,
      active: true,
      prices: {
        "0-10": 50,
        "11-15": 65,
        "16-20": 75,
        "21-25": 90,
        "26-40": 120,
        "41-50": 145,
        "51-80": 200,
        "81-100": 245,
        "101-150": 340
      }
    },
    {
      id: "eight-seater",
      name: "8-Seater",
      capacity: 8,
      luggage: 8,
      active: true,
      prices: {
        "0-10": 65,
        "11-15": 80,
        "16-20": 95,
        "21-25": 110,
        "26-40": 145,
        "41-50": 175,
        "51-80": 245,
        "81-100": 295,
        "101-150": 420
      }
    }
  ],
  bookings: []
};

export async function readStore() {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    return migrateStore(JSON.parse(raw));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeStore(seed);
    return structuredClone(seed);
  }
}

export async function writeStore(data) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

function migrateStore(data) {
  return {
    ...seed,
    ...data,
    company: { ...seed.company, ...data.company },
    settings: { ...seed.settings, ...data.settings },
    slabs: Array.isArray(data.slabs) && data.slabs.length ? data.slabs : seed.slabs,
    vehicles: Array.isArray(data.vehicles) && data.vehicles.length ? data.vehicles : seed.vehicles,
    bookings: Array.isArray(data.bookings) ? data.bookings : []
  };
}

export { defaultSlabs };
