import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";
import { getSystemConfig } from "../services/config.js";
import { getBookingPayload } from "./public.js";

const router = Router();

router.post("/login", async (request, response, next) => {
  try {
    const { username, password } = z.object({ username: z.string(), password: z.string() }).parse(request.body);
    const result = await query("SELECT id, username, password_hash FROM admins WHERE username = $1", [username]);
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      response.status(401).json({ error: "Invalid admin credentials." });
      return;
    }
    const token = jwt.sign({ id: admin.id, username: admin.username, role: "admin" }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "12h" });
    response.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAdmin, (request, response) => {
  response.json({ admin: request.admin });
});

router.get("/dashboard", requireAdmin, async (_request, response, next) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total_bookings,
        COALESCE(SUM((quote_breakdown->>'total')::numeric), 0)::numeric(10,2) AS revenue,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS bookings_7d
      FROM bookings
    `);
    const fleet = await query("SELECT COUNT(*)::int AS active_vehicles FROM vehicles WHERE active = TRUE");
    const latest = await query("SELECT id FROM bookings ORDER BY created_at DESC LIMIT 8");
    response.json({
      totalBookings: result.rows[0].total_bookings,
      revenue: Number(result.rows[0].revenue),
      bookings7d: result.rows[0].bookings_7d,
      activeVehicles: fleet.rows[0].active_vehicles,
      latestBookings: await Promise.all(latest.rows.map((row) => getBookingPayload(row.id)))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/config", requireAdmin, async (_request, response, next) => {
  try {
    response.json(await getSystemConfig({ includeInactive: true }));
  } catch (error) {
    next(error);
  }
});

router.put("/config", requireAdmin, async (request, response, next) => {
  const client = await query("SELECT 1");
  void client;
  try {
    const payload = configSchema.parse(request.body);
    await query("UPDATE app_settings SET company = $1::jsonb, pricing = $2::jsonb, updated_at = NOW() WHERE id = 1", [
      JSON.stringify(payload.company),
      JSON.stringify(payload.settings)
    ]);

    for (const vehicle of payload.vehicles) {
      const id = vehicle.id || `vehicle-${nanoid(8)}`;
      await query(
        `INSERT INTO vehicles (id, name, category, capacity, luggage, description, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          capacity = EXCLUDED.capacity,
          luggage = EXCLUDED.luggage,
          description = EXCLUDED.description,
          active = EXCLUDED.active,
          updated_at = NOW()`,
        [id, vehicle.name, vehicle.category, vehicle.capacity, vehicle.luggage, vehicle.description || "", vehicle.active]
      );

      for (const slab of payload.slabs) {
        await query(
          `INSERT INTO vehicle_prices (vehicle_id, slab_id, price)
           VALUES ($1,$2,$3)
           ON CONFLICT (vehicle_id, slab_id) DO UPDATE SET price = EXCLUDED.price`,
          [id, slab.id, Number(vehicle.prices?.[slab.id] || 0)]
        );
      }
    }

    response.json(await getSystemConfig({ includeInactive: true }));
  } catch (error) {
    next(error);
  }
});

router.get("/bookings", requireAdmin, async (_request, response, next) => {
  try {
    const result = await query("SELECT id FROM bookings ORDER BY created_at DESC LIMIT 200");
    response.json(await Promise.all(result.rows.map((row) => getBookingPayload(row.id))));
  } catch (error) {
    next(error);
  }
});

router.patch("/bookings/:id/status", requireAdmin, async (request, response, next) => {
  try {
    const { status } = z.object({ status: z.enum(["confirmed", "assigned", "completed", "cancelled"]) }).parse(request.body);
    await query("UPDATE bookings SET status = $1 WHERE id = $2", [status, request.params.id]);
    response.json(await getBookingPayload(request.params.id));
  } catch (error) {
    next(error);
  }
});

const configSchema = z.object({
  company: z.record(z.any()),
  settings: z.record(z.any()),
  slabs: z.array(z.object({ id: z.string(), minMiles: z.number(), maxMiles: z.number(), label: z.string().optional() })),
  vehicles: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    category: z.string().min(2),
    capacity: z.coerce.number().min(1),
    luggage: z.coerce.number().min(0),
    description: z.string().optional(),
    active: z.boolean(),
    prices: z.record(z.coerce.number())
  }))
});

export default router;
