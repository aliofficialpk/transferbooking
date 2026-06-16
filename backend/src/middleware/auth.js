import jwt from "jsonwebtoken";

export function requireAdmin(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    response.status(401).json({ error: "Admin login required." });
    return;
  }
  try {
    request.admin = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    next();
  } catch {
    response.status(401).json({ error: "Session expired. Please sign in again." });
  }
}
