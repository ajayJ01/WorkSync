const task = require("../controllers/taskController");
const Task = require("../models/Task");
const { success } = require("./response");

const AI_TASKS_PAGE_LIMIT = Math.min(
  parseInt(process.env.AI_CHAT_TASKS_LIMIT, 10) || 200,
  500
);

function applyAiListQuery(req, input) {
  req.query = { ...(req.query || {}), page: 1, limit: String(AI_TASKS_PAGE_LIMIT) };
  if (input?.status) req.query.status = input.status;
}

// ⚠️ NOTE: createTask, submitTask, deleteTask — AI se allowed nahi hain
// createTask/submitTask → multipart form require karte hain
// deleteTask → permission se hata diya gaya hai

async function executeTool(tool, input, req, reply) {
  switch (tool) {

    case "getTasks": {
      const userId = req.user.id;
      if (input?.taskId && /^[a-f\d]{24}$/i.test(String(input.taskId))) {
        const one = await Task.findOne({
          _id: input.taskId,
          $or: [{ createdBy: userId }, { assignedTo: userId }],
        })
          .populate("assignedTo", "name email")
          .populate("createdBy", "name email")
          .lean();
        if (!one) {
          return reply.send({
            success: false,
            message: "Task nahi mila — ya tumhare paas access nahi hai.",
          });
        }
        return success(reply, "Task fetched successfully", {
          tasks: [one],
          totalPages: 1,
          currentPage: 1,
          totalCount: 1,
        });
      }
      applyAiListQuery(req, input);
      return task.getAllTasks(req, reply);
    }

    case "startTask":
      if (!input?.taskId) {
        return reply.send({
          success: false,
          message: "Kaun sa task start karein? Task ID batao 😊",
        });
      }
      req.params = { id: input.taskId };
      return task.startTask(req, reply);

    case "cancelTask":
      if (!input?.taskId) {
        return reply.send({
          success: false,
          message: "Kaun sa task cancel karein? Task ID batao 😊",
        });
      }
      req.params = { id: input.taskId };
      return task.cancelTask(req, reply);

    case "cancelPendingTasks": {
      const userId = req.user.id;
      const filter = {
        $and: [
          { $or: [{ createdBy: userId }, { assignedTo: userId }] },
          { status: "pending" },
        ],
      };
      const count = await Task.countDocuments(filter);
      if (count === 0) {
        return reply.send({
          success: false,
          message: "Koi pending task nahi mila — cancel karne ke liye kuch hai hi nahi.",
        });
      }
      await Task.updateMany(filter, { $set: { status: "cancelled", updatedAt: new Date() } });
      return success(reply, `${count} pending task(s) cancelled`, { cancelledCount: count });
    }

    case "startPendingTasks": {
      const userId = req.user.id;
      const filter = {
        $and: [
          { $or: [{ createdBy: userId }, { assignedTo: userId }] },
          { status: "pending" },
        ],
      };
      const count = await Task.countDocuments(filter);
      if (count === 0) {
        return reply.send({
          success: false,
          message: "Koi pending task nahi jo start ho sake.",
        });
      }
      await Task.updateMany(filter, { $set: { status: "in_progress", updatedAt: new Date() } });
      return success(reply, `${count} pending task(s) started`, { startedCount: count });
    }

    case "extendPendingDueDate": {
      const userId = req.user.id;
      const days = Math.min(Math.max(parseInt(input?.days, 10) || 1, 1), 365);
      const filter = {
        $and: [
          { $or: [{ createdBy: userId }, { assignedTo: userId }] },
          { status: "pending" },
        ],
      };
      const list = await Task.find(filter).lean();
      if (list.length === 0) {
        return reply.send({
          success: false,
          message: "Koi pending task nahi.",
        });
      }
      if (list.length > 1) {
        return reply.send({
          success: false,
          message: `${list.length} pending tasks hain — pehle list dikhao aur task ID do, ya jab sirf ek pending ho tab ye command chalegi.`,
        });
      }
      const t = list[0];
      const base = t.dueDate ? new Date(t.dueDate) : new Date();
      base.setHours(12, 0, 0, 0);
      base.setDate(base.getDate() + days);
      await Task.updateOne({ _id: t._id }, { $set: { dueDate: base, updatedAt: new Date() } });
      const populated = await Task.findById(t._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();
      return success(reply, `Due date ${days} din extend ho gayi`, populated);
    }

    case "updateTaskDueDate": {
      const userId = req.user.id;
      const taskId = input?.taskId;
      const rawDue = input?.dueDate;
      if (!taskId || !/^[a-f\d]{24}$/i.test(String(taskId))) {
        return reply.send({
          success: false,
          message: "Task ID missing ya galat hai.",
        });
      }
      const dueDate = rawDue ? new Date(rawDue) : null;
      if (!dueDate || isNaN(dueDate.getTime())) {
        return reply.send({
          success: false,
          message: "Due date invalid hai — ISO ya clear date bhejo.",
        });
      }
      const taskDoc = await Task.findOne({
        _id: taskId,
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      });
      if (!taskDoc) {
        return reply.send({
          success: false,
          message: "Task nahi mila ya access nahi hai.",
        });
      }
      taskDoc.dueDate = dueDate;
      taskDoc.updatedAt = new Date();
      await taskDoc.save();
      const populated = await Task.findById(taskDoc._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();
      return success(reply, "Due date update ho gayi", populated);
    }

    case "verifyTask":
      if (!input?.taskId) {
        return reply.send({
          success: false,
          message: "Kaun sa task verify karein? Task ID batao 😊",
        });
      }
      req.params = { id: input.taskId };
      req.body = {
        status: input.status || "verified",
        remark: input.remark || "",
      };
      return task.adminTaskVerify(req, reply);

    case "exportTasks":
      applyAiListQuery(req, input);
      return task.getAllTasks(req, reply);

    default:
      return reply.send({
        success: false,
        message: "Ye kaam nahi kar sakta main 😅 Tasks dekhna, start/cancel/verify karna — ye sab kar sakta hoon!",
      });
  }
}

module.exports = { executeTool };