const PERMISSIONS = {
  user: [
    "getTasks",
    "startTask",
    "startPendingTasks",
    "submitTask",
    "exportTasks",
    "updateTaskDueDate",
    "updateTaskTitle",
    "extendPendingDueDate",
    "updateTaskFile",
  ],
  admin: [
    "getTasks",
    "createTask",
    "createSimpleTask",
    "startTask",
    "startPendingTasks",
    "submitTask",
    "cancelTask",
    "cancelPendingTasks",
    "updateTask",
    "updateTaskDueDate",
    "updateTaskTitle",
    "extendPendingDueDate",
    "assignTask",
    "updateTaskFile",
    "verifyTask",
    "exportTasks"
  ]
};

const DANGEROUS_TOOLS = ["cancelTask", "cancelPendingTasks", "startPendingTasks"];

module.exports = { PERMISSIONS, DANGEROUS_TOOLS };