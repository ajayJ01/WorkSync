const { quickPatternMatch } = require('./utils/smartIntentClassifier');

console.log("Testing Task Title Extraction...");

const tests = [
  'task jiska title "Final Test" hai usko complete mark krdo',
  'task jiska title "final Test"hai usme file update krni hai',
  'jiska title "Final Test" hai usko',
  'task "Final Test" ko update karo'
];

tests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: "${test}"`);
  const result = quickPatternMatch(test);
  console.log("Result:", JSON.stringify(result, null, 2));
});
