import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import path from "path";
import { existsSync } from "fs";

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

// In production (Docker / external server), serve the built frontend.
// The build script copies frontend assets to dist/public/ alongside dist/index.cjs.
// STATIC_DIR env var can override the default resolved path.
if (process.env.NODE_ENV === "production") {
  const publicDir =
    process.env.STATIC_DIR ??
    path.join(process.cwd(), "dist", "public");

  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }
}

export default app;
