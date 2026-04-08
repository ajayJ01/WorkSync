const authController = require("../controllers/authController");
const authValidation = require("../validations/authValidations.js");
const authenticate = require("../middlewares/authMiddleware");

async function authRoutes(fastify, options) {
  fastify.post(
    "/register",
    { schema: authValidation.register },
    authController.registerUser
  );
  fastify.post(
    "/login",
    { schema: authValidation.login },
    authController.loginUser
  );
  fastify.post("/logout", { preHandler: authenticate }, authController.logoutUser);
}

module.exports = authRoutes;
