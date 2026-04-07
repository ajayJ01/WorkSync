require("dotenv").config();
const path = require("path");

const fastify = require("fastify")({
  logger: true,
  ajv: {
    customOptions: {
      allErrors: true,
    },
  },
});

const connectDB = require("./config/db");
const fastifyCors = require("@fastify/cors");
const fastifyMultipart = require("@fastify/multipart");
const fastifyStatic = require("@fastify/static");

// 1️⃣ Enable CORS
fastify.register(fastifyCors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

// 2️⃣ Multipart (file upload)
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

// 3️⃣ Static folder (uploads)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
});

// 4️⃣ Health check
fastify.get("/", async () => {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  };
});

// 5️⃣ Routes
fastify.register(require("./routes/authRoutes"));
fastify.register(require("./routes/userRoutes"));
fastify.register(require("./routes/taskRoutes"));

// 6️⃣ Global Error Handler
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    const errors = {};
    error.validation.forEach((err) => {
      const field = err.instancePath
        .replace(/^\/body\/?/, "")
        .replace(/^\//, "");
      errors[field] = err.message;
    });

    return reply.code(400).send({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  return reply.code(error.statusCode || 500).send({
    success: false,
    message: error.message || "Something went wrong",
  });
});

// 7️⃣ Start Server
const start = async () => {
  try {
    const PORT = parseInt(process.env.PORT) || 5000;

    // ✅ DB connect first
    await connectDB();

    // ✅ Start cron only once (PM2 safe)
    if (
      process.env.NODE_APP_INSTANCE === "0" ||
      !process.env.NODE_APP_INSTANCE
    ) {
      require("./cron/updateDueTasks");
    }

    // ✅ Start server
    await fastify.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    console.log(`🚀 Server running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
