console.log("Starting server test...");

try {
  // Test basic imports
  console.log("Testing imports...");
  
  // Test if we can require our modules
  const path = require('path');
  console.log("✅ Path module loaded");
  
  const fs = require('fs');
  console.log("✅ FS module loaded");
  
  // Test smart intent classifier
  console.log("Testing smart intent classifier...");
  const smartClassifier = require('./utils/smartIntentClassifier');
  console.log("✅ Smart intent classifier loaded");
  console.log("Available functions:", Object.keys(smartClassifier));
  
  console.log("Server test completed successfully!");
  
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
}
