const PERMISSIONS = {
  user: [
    "getTasks",
    "startTask",
    "startPendingTasks",
    "submitTask",
    "exportTasks",
    "updateTaskDueDate",
    "extendPendingDueDate",
  ],
  admin: [
    "getTasks",
    "createTask",
    "startTask",
    "startPendingTasks",
    "submitTask",
    "cancelTask",
    "cancelPendingTasks",
    "updateTask",
    "updateTaskDueDate",
    "extendPendingDueDate",
    "verifyTask",
    "exportTasks"
  ]
};

const DANGEROUS_TOOLS = ["cancelTask", "cancelPendingTasks", "startPendingTasks"];

module.exports = { PERMISSIONS, DANGEROUS_TOOLS };