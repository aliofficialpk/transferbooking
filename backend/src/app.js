import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { migrate } from "./db/migrate.js";

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://127.0.0.1:5173,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

await migrate();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS."));
  },
  credentials: true
}));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "airport-transfer-backend" });
});

app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use((error, _request, response, _next) => {
  const status = error.status || (error.name === "ZodError" ? 422 : 500);
  response.status(status).json({
    error: error.name === "ZodError" ? "Please check the submitted fields." : error.message || "Server error."
  });
});

export default app;
