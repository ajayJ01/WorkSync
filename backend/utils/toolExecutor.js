const task = require("../controllers/taskController");
const Task = require("../models/Task");
const User = require("../models/User");
const { success } = require("./response");
const { parseDueDateFromText } = require("./parseDueDate");
const { uploadFile } = require("./fileUpload");
const { escapeRegex } = require("./regexSafe");

const AI_TASKS_PAGE_LIMIT = Math.min(
  parseInt(process.env.AI_CHAT_TASKS_LIMIT, 10) || 200,
  500
);

function applyAiListQuery(req, input) {
  req.query = { ...(req.query || {}), page: 1, limit: String(AI_TASKS_PAGE_LIMIT) };
  if (input?.search) req.query.search = String(input.search);
  if (input?.status) req.query.status = input.status;
  if (input?.statusIn) req.query.statusIn = input.statusIn;
  if (input?.from) req.query.from = input.from;
  if (input?.to) req.query.to = input.to;
  if (input?.assignedTo) req.query.assignedTo = String(input.assignedTo);
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

    case "createSimpleTask": {
      const userId = req.user.id;
      const title = String(input?.title || input?.taskTitle || "").trim();
      const description = String(input?.description || "").trim();
      const dueRaw = String(input?.dueDate || "").trim();
      const fromOriginalText = parseDueDateFromText(String(req.aiOriginalText || ""));

      if (!title) {
        return reply.send({
          success: false,
          message:
            "Quick task banane ke liye title do. Example: \"kal 5 baje tak client follow-up task banao\"",
        });
      }

      const parsedDue =
        fromOriginalText ||
        (dueRaw && !isNaN(new Date(dueRaw).getTime()) && new Date(dueRaw)) ||
        parseDueDateFromText(`${title} ${description} ${dueRaw}`) ||
        null;

      if (!parsedDue) {
        return reply.send({
          success: false,
          message:
            "Due date samajh nahi aayi. Example: 2026-04-25, 25/4/2026, ya 25 April 2026.",
        });
      }

      // Guard: chat-created task should not be born already overdue.
      const now = new Date();
      if (parsedDue.getTime() < now.getTime() - 60 * 1000) {
        return reply.send({
          success: false,
          message:
            "Due date past me aa rahi hai. Future time do (e.g. \"kal 12 bje\", \"today 11:59 PM\").",
        });
      }

      let fileUrl = null;
      if (req.aiUploadFile?.buffer) {
        fileUrl = await uploadFile(req.aiUploadFile, {
          folder: "uploads/tasks",
          allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
          maxSizeMB: 5,
        });
      }

      const created = await Task.create({
        title,
        description: description || "Created via chat",
        dueDate: parsedDue,
        ...(fileUrl && { fileUrl }),
        assignedTo: [userId],
        createdBy: userId,
        status: "pending",
      });

      const populated = await Task.findById(created._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();

      return success(reply, "Quick task create ho gaya", populated);
    }

    case "updateTaskFile": {
      const userId = req.user.id;
      const taskId = input?.taskId;
      if (!taskId || !/^[a-f\d]{24}$/i.test(String(taskId))) {
        return reply.send({
          success: false,
          message: "Kaunsi task mein file update karni hai? Task ID ya clear reference do.",
        });
      }
      if (!req.aiUploadFile?.buffer) {
        return reply.send({
          success: false,
          message: "File missing hai. Pehle file attach karo, phir command bhejo.",
        });
      }

      const taskDoc = await Task.findOne({
        _id: taskId,
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      });
      if (!taskDoc) {
        return reply.send({
          success: false,
          message: "Task nahi mili ya tumhare paas access nahi hai.",
        });
      }

      const fileUrl = await uploadFile(req.aiUploadFile, {
        folder: "uploads/tasks",
        allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
        maxSizeMB: 5,
      });
      taskDoc.fileUrl = fileUrl;
      taskDoc.updatedAt = new Date();
      await taskDoc.save();

      const populated = await Task.findById(taskDoc._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();
      return success(reply, "Task file update ho gayi", populated);
    }

    case "assignTask": {
      const userId = req.user.id;
      let taskId = input?.taskId;
      const q = String(input?.assigneeQuery || "").trim();
      const taskTitle = String(input?.taskTitle || "").trim();
      const dueRaw = String(input?.dueDate || "").trim();

      const visibility = { $or: [{ createdBy: userId }, { assignedTo: userId }] };
      if (!taskId) {
        // 1) dueDate hint se resolve
        if (dueRaw) {
          const d = new Date(dueRaw);
          if (!isNaN(d.getTime())) {
            const candidates = await Task.find(visibility).select("_id dueDate status title").lean();
            const same = candidates.filter((t) => {
              if (!t?.dueDate) return false;
              const x = new Date(t.dueDate);
              return (
                x.getMonth() === d.getMonth() &&
                x.getDate() === d.getDate() &&
                x.getHours() === d.getHours() &&
                x.getMinutes() === d.getMinutes()
              );
            });
            if (same.length === 1) taskId = String(same[0]._id);
            else if (same.length > 1) {
              const active = same.filter((t) => t.status !== "cancelled" && t.status !== "verified");
              if (active.length === 1) taskId = String(active[0]._id);
            }
          }
        }

        // 2) title hint se resolve
        if (!taskId && taskTitle) {
          const sameTitle = await Task.find({
            $and: [
              visibility,
              { title: { $regex: escapeRegex(taskTitle), $options: "i" } },
            ],
          })
            .select("_id status")
            .lean();
          if (sameTitle.length === 1) taskId = String(sameTitle[0]._id);
          else if (sameTitle.length > 1) {
            const active = sameTitle.filter((t) => t.status !== "cancelled" && t.status !== "verified");
            if (active.length === 1) taskId = String(active[0]._id);
          }
        }
      }

      if (!taskId || !/^[a-f\d]{24}$/i.test(String(taskId))) {
        return reply.send({
          success: false,
          message: "Kaunsi task assign karni hai? Task ID do, ya exact due date/title ke saath bolo.",
        });
      }
      if (!q) {
        return reply.send({
          success: false,
          message: "Kisko assign karna hai? Name ya email likho (e.g. test user).",
        });
      }

      const taskDoc = await Task.findOne({ _id: taskId, ...visibility });
      if (!taskDoc) {
        return reply.send({
          success: false,
          message: "Task nahi mili ya tumhare paas access nahi hai.",
        });
      }

      const queries = q.split(/\s+(?:and|aur|&|,)\s+/i).map(s => s.trim().replace(/\s+(user|users)$/i, "")).filter(Boolean);
      let foundUsers = [];
      for (const iq of queries) {
        let matches = [];
        if (iq.includes("@")) {
          matches = await User.find({
            email: { $regex: `^${escapeRegex(iq)}$`, $options: "i" },
          })
            .select("_id name email role")
            .lean();
        } else {
          matches = await User.find({
            name: { $regex: escapeRegex(iq), $options: "i" },
          })
            .select("_id name email role")
            .lean();
        }

        if (!matches.length) {
          return reply.send({
            success: false,
            message: `User "${iq}" nahi mila.`,
          });
        }
        if (matches.length > 1) {
          if (req.setDraft) {
             req.setDraft({ tool: "assignTask", input, clarifyQuery: iq });
             return reply.send({
                success: true,
                type: "clarify",
                message: `\"${iq}\" se ${matches.length} users mil rahe hain. Exact email do.`,
             });
          }
          return reply.send({
            success: false,
            message: `\"${iq}\" se ${matches.length} users mil rahe hain. Exact email do.`,
          });
        }
        foundUsers.push(matches[0]);
      }

      const uniqueIds = [...new Set(foundUsers.map(u => String(u._id)))];
      taskDoc.assignedTo = uniqueIds;
      taskDoc.updatedAt = new Date();
      await taskDoc.save();

      const populated = await Task.findById(taskDoc._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();

      const names = foundUsers.map(u => u.name).join(", ");
      return success(reply, `Task ${names} ko assign ho gayi`, populated);
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
      const incrementDays = parseInt(input?.incrementDays, 10);
      if (!taskId || !/^[a-f\d]{24}$/i.test(String(taskId))) {
        return reply.send({
          success: false,
          message: "Task ID missing ya galat hai.",
        });
      }
      const dueDate = rawDue ? new Date(rawDue) : null;
      if ((!dueDate || isNaN(dueDate.getTime())) && !(incrementDays > 0)) {
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
      if (incrementDays > 0) {
        const base = taskDoc.dueDate ? new Date(taskDoc.dueDate) : new Date();
        base.setDate(base.getDate() + Math.min(incrementDays, 365));
        taskDoc.dueDate = base;
      } else {
        taskDoc.dueDate = dueDate;
      }
      taskDoc.updatedAt = new Date();
      await taskDoc.save();
      const populated = await Task.findById(taskDoc._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();
      return success(reply, "Due date update ho gayi", populated);
    }

    case "updateTaskTitle": {
      const userId = req.user.id;
      const taskId = input?.taskId;
      const nextTitle = String(input?.title || "").trim();
      if (!taskId || !/^[a-f\d]{24}$/i.test(String(taskId))) {
        return reply.send({
          success: false,
          message: "Task ID missing ya galat hai.",
        });
      }
      if (!nextTitle) {
        return reply.send({
          success: false,
          message: "Naya title missing hai. Example: title update karo ki fix bugs.",
        });
      }

      const taskDoc = await Task.findOne({
        _id: taskId,
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      });
      if (!taskDoc) {
        return reply.send({
          success: false,
          message: "Task nahi mili ya access nahi hai.",
        });
      }

      taskDoc.title = nextTitle.slice(0, 140);
      taskDoc.updatedAt = new Date();
      await taskDoc.save();

      const populated = await Task.findById(taskDoc._id)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .lean();
      return success(reply, "Task title update ho gaya", populated);
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