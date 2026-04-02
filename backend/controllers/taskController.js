const Task = require("../models/Task");
const { success, error, notFound, conflict } = require("../utils/response");
const { uploadFile } = require("../utils/fileUpload");
const { escapeRegexTruncated } = require("../utils/regexSafe");

const MAX_TASKS_PAGE_SIZE = 100;
const DEFAULT_TASKS_PAGE_SIZE = 10;

function clampTasksPage(n) {
  const p = parseInt(n, 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function clampTasksLimit(n) {
  const l = parseInt(n, 10);
  if (!Number.isFinite(l) || l < 1) return DEFAULT_TASKS_PAGE_SIZE;
  return Math.min(l, MAX_TASKS_PAGE_SIZE);
}

function parseRangeBoundary(input, isEnd = false) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // Date-only query should be interpreted in LOCAL timezone day boundaries.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return isEnd
      ? new Date(y, mo, d, 23, 59, 59, 999)
      : new Date(y, mo, d, 0, 0, 0, 0);
  }

  const dt = new Date(raw);
  return isNaN(dt.getTime()) ? null : dt;
}

exports.createTask = async (req, reply) => {
  try {
    if (!req.isMultipart()) {
      return reply.status(400).send({ message: "Request is not multipart" });
    }

    const parts = req.parts();
    const formData = {};
    let filePartData = null;


    for await (const part of parts) {
      if (part.file && part.fieldname === "file") {
        const buffer = await part.toBuffer();

        filePartData = {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
          buffer: buffer,
        };
      } else if (part.type === "field") {
        if (formData[part.fieldname]) {
          if (Array.isArray(formData[part.fieldname])) {
            formData[part.fieldname].push(part.value);
          } else {
            formData[part.fieldname] = [formData[part.fieldname], part.value];
          }
        } else {
          formData[part.fieldname] = part.value;
        }
      } else {
        if (part.file) {
          await part.toBuffer();
        }
      }
    }

    const { title, description, dueDate, assignedTo } = formData;

    // Ensure assignedTo is always an array
    const assignedList = Array.isArray(assignedTo)
      ? assignedTo
      : assignedTo
        ? [assignedTo]
        : [];

    let fileUrl = null;

    if (filePartData) {
      fileUrl = await uploadFile(filePartData, {
        folder: "uploads/tasks",
        allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
        maxSizeMB: 5,
      });
    } else {
      console.log("ℹ️ No file provided for upload.");
    }

    const task = await Task.create({
      title,
      description,
      fileUrl,
      dueDate,
      assignedTo: assignedList,
      createdBy: req.user.id,
    });

    return success(reply, "Task created & assigned successfully", task);
  } catch (err) {
    console.error("🚨 Task Creation Error:", err);
    return error(reply, "Failed to create task", err.message);
  }
};

exports.updateTask = async (req, reply) => {
  try {
    if (!req.isMultipart()) {
      return reply.status(400).send({ message: "Request is not multipart" });
    }

    const parts = req.parts();
    const formData = {};
    let filePartData = null;

    for await (const part of parts) {
      if (part.file && part.fieldname === "file") {
        const buffer = await part.toBuffer();
        filePartData = {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
          buffer: buffer,
        };
      } else if (part.type === "field") {
        if (formData[part.fieldname]) {
          if (Array.isArray(formData[part.fieldname])) {
            formData[part.fieldname].push(part.value);
          } else {
            formData[part.fieldname] = [formData[part.fieldname], part.value];
          }
        } else {
          formData[part.fieldname] = part.value;
        }
      } else {
        if (part.file) {
          await part.toBuffer();
        }
      }
    }

    const { title, description, dueDate, assignedTo, status } = formData;
    const assignedList = Array.isArray(assignedTo)
      ? assignedTo
      : assignedTo
        ? [assignedTo]
        : [];

    let fileUrl = null;
    if (filePartData) {
      fileUrl = await uploadFile(filePartData, {
        folder: "uploads/tasks",
        allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
        maxSizeMB: 5,
      });
    }

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        dueDate,
        assignedTo: assignedList,
        ...(status && { status }),
        ...(fileUrl && { fileUrl }),
      },
      { new: true }
    );

    if (!updated) {
      return notFound(reply, "Task not found");
    }

    return success(reply, "Task updated successfully", updated);
  } catch (err) {
    console.error("🚨 Task Update Error:", err);
    return error(reply, "Failed to update task", err.message);
  }
};

exports.getAllTasks = async (req, reply) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      search,
      status,
      statusIn,
      from,
      to,
      assignedTo,
    } = req.query;
    const pageNum = clampTasksPage(page);
    const limitNum = clampTasksLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = req.user?.role === "admin";
    const andParts = [];
    if (!isAdmin) {
      andParts.push({
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      });
    }

    if (search) {
      const safeSearch = escapeRegexTruncated(search);
      if (safeSearch) {
        andParts.push({
          $or: [
            { title: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } },
          ],
        });
      }
    }

    if (status) {
      andParts.push({ status });
    }
    if (statusIn) {
      const list = String(statusIn)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) andParts.push({ status: { $in: list } });
    }

    if (from && to) {
      const fromDate = parseRangeBoundary(from, false);
      const toDate = parseRangeBoundary(to, true);
      if (fromDate && toDate) {
        andParts.push({
          dueDate: {
            $gte: fromDate,
            $lte: toDate,
          },
        });
      }
    }

    if (assignedTo) {
      const raw = String(assignedTo)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const assignedIds = raw.filter((id) => /^[a-f\d]{24}$/i.test(id));
      if (raw.length && assignedIds.length === 0) {
        return error(reply, 400, "assignedTo must be valid comma-separated user IDs.");
      }
      if (assignedIds.length) {
        andParts.push({
          assignedTo: { $in: assignedIds },
        });
      }
    }

    const filter = andParts.length ? { $and: andParts } : {};

    const totalCount = await Task.countDocuments(filter);

    const tasks = await Task.find(filter)
      .skip(skip)
      .limit(limitNum)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return success(reply, "Tasks fetched successfully", {
      tasks,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      totalCount,
    });
  } catch (err) {
    console.error("Fetch Tasks Error:", err);
    return error(reply);
  }
};

exports.getMyTasks = async (req, reply) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, search, status, statusIn, from, to } = req.query;
    const pageNum = clampTasksPage(page);
    const limitNum = clampTasksLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      assignedTo: userId,
    };

    const andConditions = [];

    if (search) {
      const safeSearch = escapeRegexTruncated(search);
      if (safeSearch) {
        andConditions.push({
          $or: [
            { title: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } },
          ],
        });
      }
    }

    if (status) {
      andConditions.push({ status });
    }
    if (statusIn) {
      const list = String(statusIn)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) andConditions.push({ status: { $in: list } });
    }

    if (from && to) {
      const fromDate = parseRangeBoundary(from, false);
      const toDate = parseRangeBoundary(to, true);
      if (fromDate && toDate) {
        andConditions.push({
          dueDate: {
            $gte: fromDate,
            $lte: toDate,
          },
        });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const totalCount = await Task.countDocuments(filter);

    const tasks = await Task.find(filter)
      .skip(skip)
      .limit(limitNum)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return success(reply, "My Tasks fetched successfully", {
      tasks,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      totalCount,
    });
  } catch (err) {
    console.error("Fetch My Tasks Error:", err);
    return error(reply);
  }
};

exports.cancelTask = async (req, reply) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = await Task.findOne({ _id: taskId });

    if (!task) {
      return notFound(reply, "Task not found");
    }

    if (task.status === "cancelled") {
      return conflict(reply, "Task is already cancelled");
    }

    task.status = "cancelled";
    task.updatedAt = new Date();
    await task.save();

    return success(reply, "Task cancelled successfully", task);
  } catch (err) {
    console.error("Cancel Task Error:", err);
    return error(reply);
  }
};

exports.adminTaskVerify = async (req, reply) => {
  try {
    const taskId = req.params.id;
    const adminId = req.user.id;
    const { status, remark } = req.body;

    const task = await Task.findById(taskId);

    if (!task) {
      return notFound(reply, "Task not found");
    }

    // Only allow if task is in "submitted" (or similar) state
    if (task.status !== "submitted") {
      return reply.code(409).send({ message: `Cannot verify/reject a task in "${task.status}" state!` });
    }

    // VERIFY
    if (status === "verified") {
      task.status = "verified";
      task.remark = ""; // remove previous remark (if any)
      task.verifiedBy = adminId;
      task.verifiedAt = new Date();
    }
    // REJECT
    else if (status === "rejected") {
      task.status = "rejected";
      task.remark = remark?.trim() || "";
      // Optionally: store adminId, rejectCount, etc.
      task.rejectedBy = adminId;
      task.rejectedAt = new Date();
    }

    task.updatedAt = new Date();
    await task.save();

    return success(reply, `Task marked as ${status}.`, task);
  } catch (err) {
    console.error("Admin Task Verify Error:", err);
    return error(reply);
  }
};

exports.startTask = async (req, reply) => {
  try {
    const taskId = req.params.id;

    const task = await Task.findOne({ _id: taskId });

    if (!task) {
      return notFound(reply, "Task not found");
    }

    if (task.status !== "pending" && task.status !== "rejected") {
      return conflict(reply, "Only pending or rejectedtasks can be started");
    }

    task.status = "in_progress";
    task.updatedAt = new Date();
    await task.save();

    return success(reply, "Task marked as in progress", task);
  } catch (err) {
    console.error("Start Task Error:", err);
    return error(reply);
  }
};

exports.submitTask = async (req, reply) => {
  try {
    if (!req.isMultipart()) {
      return reply.status(400).send({ message: "Request is not multipart" });
    }

    const taskId = req.params.id;
    const formData = {};
    let filePartData = null;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.file && part.fieldname === "file") {
        const buffer = await part.toBuffer();
        filePartData = {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
          buffer: buffer,
        };
      } else if (part.type === "field") {
        if (formData[part.fieldname]) {
          if (Array.isArray(formData[part.fieldname])) {
            formData[part.fieldname].push(part.value);
          } else {
            formData[part.fieldname] = [formData[part.fieldname], part.value];
          }
        } else {
          formData[part.fieldname] = part.value;
        }
      } else if (part.file) {
        await part.toBuffer();
      }
    }

    const { notes } = formData;

    const task = await Task.findById(taskId);
    if (!task) {
      return notFound(reply, "Task not found");
    }

    if (task.status !== "in_progress" && task.status !== "rejected" &&  task.status !== "pending") {
      return conflict(reply, "Only in-progress and pending tasks can be submitted");
    }

    let submissionFileUrl = null;
    if (filePartData) {
      submissionFileUrl = await uploadFile(filePartData, {
        folder: "uploads/tasks/completions",
        allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
        maxSizeMB: 5,
      });
    }

    task.status = "submitted";
    task.submissionNotes = notes;
    task.submissionFileUrl = submissionFileUrl;
    task.completedAt = new Date();
    await task.save();

    return success(reply, "Task submitted successfully", task);
  } catch (err) {
    console.error("🚨 submitTask error:", err);
    return error(reply, "Failed to submit task", err.message);
  }
};
