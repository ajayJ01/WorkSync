console.log("Testing server startup...");

try {
  // Test basic imports
  console.log("1. Testing basic imports...");
  const path = require('path');
  console.log("✅ Path module loaded");
  
  // Test smart intent classifier
  console.log("2. Testing smart intent classifier...");
  const smartClassifier = require('./utils/smartIntentClassifier');
  console.log("✅ Smart intent classifier loaded");
  console.log("Available functions:", Object.keys(smartClassifier));
  
  // Test smart task finder
  console.log("3. Testing smart task finder...");
  const taskFinder = require('./utils/smartTaskFinder');
  console.log("✅ Smart task finder loaded");
  console.log("Available functions:", Object.keys(taskFinder));
  
  // Test AI controller
  console.log("4. Testing AI controller...");
  const aiController = require('./controllers/aiController');
  console.log("✅ AI controller loaded");
  
  console.log("✅ All modules loaded successfully!");
  
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
}
