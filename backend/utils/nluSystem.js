const { NlpManager } = require('node-nlp');

let manager = null;

async function initNLU() {
  if (manager) return manager;
  
  // Force English/Hinglish tokenization
  manager = new NlpManager({ languages: ['en'], forceNER: true, nlu: { log: false } });

  // 1. getTasks
  manager.addDocument('en', 'tasks dikhao', 'getTasks');
  manager.addDocument('en', 'show my tasks', 'getTasks');
  manager.addDocument('en', 'mujhe mere tasks dikha do', 'getTasks');
  manager.addDocument('en', 'list my tasks', 'getTasks');
  manager.addDocument('en', 'mere task kya hai', 'getTasks');
  manager.addDocument('en', 'fetch tasks', 'getTasks');
  manager.addDocument('en', 'pending kya hai', 'getTasks');
  manager.addDocument('en', 'cancelled tasks dikhao', 'getTasks');
  manager.addDocument('en', 'canceled tasks show', 'getTasks');
  manager.addDocument('en', 'cancelled task bta', 'getTasks');
  manager.addDocument('en', 'cancelled task batao', 'getTasks');
  manager.addDocument('en', 'pending task bta', 'getTasks');
  manager.addDocument('en', 'verified tasks list', 'getTasks');

  // 2. createSimpleTask
  manager.addDocument('en', 'create a task', 'createSimpleTask');
  manager.addDocument('en', 'new task banao', 'createSimpleTask');
  manager.addDocument('en', 'ek task add kardo', 'createSimpleTask');
  manager.addDocument('en', 'task banane ka hai', 'createSimpleTask');
  manager.addDocument('en', 'naya kaam add karo', 'createSimpleTask');
  manager.addDocument('en', 'mujhe task create karni hai', 'createSimpleTask');

  // 3. updateTaskFile
  manager.addDocument('en', 'update file', 'updateTaskFile');
  manager.addDocument('en', 'attach document', 'updateTaskFile');
  manager.addDocument('en', 'upload file', 'updateTaskFile');
  manager.addDocument('en', 'usme screenshot dal do', 'updateTaskFile');
  manager.addDocument('en', 'isko attach kar do', 'updateTaskFile');
  manager.addDocument('en', 'replace the attachment', 'updateTaskFile');

  // 4. updateTaskTitle
  manager.addDocument('en', 'title change karo', 'updateTaskTitle');
  manager.addDocument('en', 'naam badal do', 'updateTaskTitle');
  manager.addDocument('en', 'update the title', 'updateTaskTitle');
  manager.addDocument('en', 'iska title set karo', 'updateTaskTitle');

  // 5. assignTask
  manager.addDocument('en', 'assign this to', 'assignTask');
  manager.addDocument('en', 'isko kaam de do', 'assignTask');
  manager.addDocument('en', 'usko saup do', 'assignTask');
  manager.addDocument('en', 'reassign it to', 'assignTask');
  manager.addDocument('en', 'test user ko assign karo', 'assignTask');
  manager.addDocument('en', 'give this to him', 'assignTask');

  // 6. startTask
  manager.addDocument('en', 'start karo', 'startTask');
  manager.addDocument('en', 'begin task', 'startTask');
  manager.addDocument('en', 'chalu kardo', 'startTask');
  manager.addDocument('en', 'isko shuru karo', 'startTask');

  // 7. cancelTask (imperative — not "cancelled tasks show")
  manager.addDocument('en', 'cancel this task', 'cancelTask');
  manager.addDocument('en', 'cancel the task', 'cancelTask');
  manager.addDocument('en', 'isko cancel karo', 'cancelTask');
  manager.addDocument('en', 'task cancel kardo', 'cancelTask');
  manager.addDocument('en', 'band kardo', 'cancelTask');
  manager.addDocument('en', 'khatam karo isko', 'cancelTask');
  manager.addDocument('en', 'stop the task', 'cancelTask');
  manager.addDocument('en', 'rok do', 'cancelTask');

  // 8. cancelPendingTasks
  manager.addDocument('en', 'saare pending cancel karo', 'cancelPendingTasks');
  manager.addDocument('en', 'cancel all pending tasks', 'cancelPendingTasks');
  manager.addDocument('en', 'sab pending rok do', 'cancelPendingTasks');

  // 9. startPendingTasks
  manager.addDocument('en', 'start all pending', 'startPendingTasks');
  manager.addDocument('en', 'sab pending start kardo', 'startPendingTasks');

  // 10. updateTaskDueDate
  manager.addDocument('en', 'due date fix kardo', 'updateTaskDueDate');
  manager.addDocument('en', 'change deadline', 'updateTaskDueDate');
  manager.addDocument('en', 'due date aage badha do', 'updateTaskDueDate');
  manager.addDocument('en', 'set due date', 'updateTaskDueDate');

  // 11. extendPendingDueDate (specific command for pending increment)
  manager.addDocument('en', 'pending task due badhao', 'extendPendingDueDate');
  manager.addDocument('en', 'pending ki time extend karo', 'extendPendingDueDate');

  // 12. verifyTask
  manager.addDocument('en', 'verify karo', 'verifyTask');
  manager.addDocument('en', 'approve kar do', 'verifyTask');
  manager.addDocument('en', 'iski verification pass karo', 'verifyTask');

  // 13. exportTasks
  manager.addDocument('en', 'export tasks', 'exportTasks');
  manager.addDocument('en', 'excel download karo', 'exportTasks');
  manager.addDocument('en', 'mujhe pdf bhej do', 'exportTasks');
  manager.addDocument('en', 'download list', 'exportTasks');

  await manager.train();
  manager.save();
  return manager;
}

async function classifyWithNLU(text) {
  if (!manager) await initNLU();
  const response = await manager.process('en', text);
  
  if (response.intent !== 'None' && response.score >= 0.70) {
     const input = {};
     const lower = text.toLowerCase();
     
     if (response.intent === 'assignTask') {
        const m = text.match(/\b(?:isko|usko|is task ko|ye task ko)\s+(.+?)\s+ko\s+(?:assigne?|assine|asign|reassigne?)\b/i) ||
                  text.match(/\b(.+?)\s+ko\s+(?:assigne?|assine|asign|reassigne?)\b/i);
        input.assigneeQuery = m ? m[1].trim() : text.replace(/assigne?|reassigne?|this|to|isko|ko|kardo|kar|do|bhai/gi, '').trim();
     }
     
     if (response.intent === 'extendPendingDueDate') {
        const m = lower.match(/(\d+)\s*(din|day|days)/);
        if (m) input.days = parseInt(m[1], 10);
        else if (/\bek din\b|one day|^\s*1\s*din\b/.test(lower)) input.days = 1;
        else if (/\b(do din|2 din|two day)\b/.test(lower)) input.days = 2;
        else input.days = 1;
     }

     return {
        tool: response.intent,
        input,
        source: 'nlu',
        confidence: response.score
     }
  }
  return null;
}

module.exports = { initNLU, classifyWithNLU };
