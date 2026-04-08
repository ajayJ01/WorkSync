const intentMonitorController = require("../controllers/intentMonitorController");
const authenticate = require("../middlewares/authMiddleware");

async function intentMonitorRoutes(fastify, options) {
  // Get classification statistics (admin only)
  fastify.get("/intent-stats", { 
    preHandler: authenticate 
  }, intentMonitorController.getIntentStats);
  
  // Test intent classification (authenticated users)
  fastify.post("/test-intent", { 
    preHandler: authenticate 
  }, intentMonitorController.testIntentClassification);
  
  // Reset learning data (admin only)
  fastify.post("/reset-learning", { 
    preHandler: authenticate 
  }, intentMonitorController.resetLearningData);
}

module.exports = intentMonitorRoutes;
