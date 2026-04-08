/**
 * 📊 Intent Classification Monitoring API
 * Track performance, learning, and system health
 */

const { 
  getClassificationStats,
  INTENT_CATEGORIES 
} = require("../utils/smartIntentClassifier");

// 📈 Get classification statistics
async function getIntentStats(req, reply) {
  try {
    const stats = getClassificationStats();
    
    return reply.send({
      success: true,
      data: {
        ...stats,
        categories: INTENT_CATEGORIES,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error("Intent stats error:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to get intent statistics"
    });
  }
}

// 🧠 Test intent classification
async function testIntentClassification(req, reply) {
  try {
    const { text, userId = "test-user" } = req.body;
    
    if (!text?.trim()) {
      return reply.status(400).send({
        success: false,
        message: "Text is required for testing"
      });
    }
    
    const { classifyWithContext } = require("../utils/smartIntentClassifier");
    
    const result = await classifyWithContext(text, userId, {
      userRole: "admin",
      userHistory: {},
      recentTasks: []
    });
    
    return reply.send({
      success: true,
      data: {
        input: text,
        result,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Intent test error:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to test intent classification"
    });
  }
}

// 🔄 Reset learning data (admin only)
async function resetLearningData(req, reply) {
  try {
    // Only allow admins
    if (req.user?.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        message: "Admin access required"
      });
    }
    
    const { clearCache = false, clearHistory = false } = req.body;
    
    if (clearCache) {
      // Clear pattern cache
      const { patternCache } = require("../utils/smartIntentClassifier");
      patternCache.clear();
    }
    
    if (clearHistory) {
      // Clear user history
      const { intentHistory } = require("../utils/smartIntentClassifier");
      intentHistory.clear();
    }
    
    return reply.send({
      success: true,
      message: "Learning data reset successfully",
      data: {
        cacheCleared: clearCache,
        historyCleared: clearHistory
      }
    });
  } catch (error) {
    console.error("Reset learning data error:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to reset learning data"
    });
  }
}

module.exports = {
  getIntentStats,
  testIntentClassification,
  resetLearningData
};
