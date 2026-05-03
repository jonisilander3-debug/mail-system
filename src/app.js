const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const methodOverride = require("method-override");
const { Pool } = require("pg");
const env = require("./config/env");
const { installFlash } = require("./utils/flash");

const authRoutes = require("./routes/auth-routes");
const dashboardRoutes = require("./routes/dashboard-routes");
const campaignRoutes = require("./routes/campaign-routes");
const settingsRoutes = require("./routes/settings-routes");
const publicRoutes = require("./routes/public-routes");
const apiRoutes = require("./routes/api-routes");

function createApp() {
  const app = express();
  const pool = new Pool({ connectionString: env.databaseUrl });
  const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
  const frontendIndexPath = path.join(frontendDistPath, "index.html");
  const hasFrontendBuild = fs.existsSync(frontendIndexPath);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }));
  app.use("/public", express.static(path.join(__dirname, "..", "public")));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(methodOverride("_method"));

  app.use(session({
    store: new pgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: "lax",
      httpOnly: true,
    },
  }));

  app.use(installFlash);
  app.use((req, res, next) => {
    res.locals.requestPath = req.path;
    next();
  });

  app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  if (hasFrontendBuild) {
    app.use("/assets", express.static(path.join(frontendDistPath, "assets")));
    app.use("/vite.svg", express.static(path.join(frontendDistPath, "vite.svg")));
  }

  app.get("/", (req, res) => {
    if (hasFrontendBuild) {
      return res.sendFile(frontendIndexPath);
    }

    if (req.session.user) {
      return res.redirect("/dashboard");
    }

    return res.redirect("/login");
  });

  app.use(authRoutes);
  app.use("/api", apiRoutes);
  app.use(publicRoutes);
  app.use(dashboardRoutes);
  app.use(campaignRoutes);
  app.use(settingsRoutes);

  if (hasFrontendBuild) {
    app.get(/^\/(?!api|public|unsubscribe).*/, (req, res, next) => {
      if (req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".map")) {
        return next();
      }

      return res.sendFile(frontendIndexPath);
    });
  }

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).render("error", {
      title: "Something went wrong",
      error,
    });
  });

  return app;
}

module.exports = { createApp };
