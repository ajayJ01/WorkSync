const Task = require("../models/Task");
const { success, error, notFound, conflict } = require("../utils/response");
const { uploadFile } = require("../utils/fileUpload");

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
      from,
      to,
      assignedTo,
    } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      $and: [
        {
          $or: [{ createdBy: userId }, { assignedTo: userId }],
        },
      ],
    };

    if (search) {
      filter.$and.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (status) {
      filter.$and.push({ status });
    }

    if (from && to) {
      filter.$and.push({
        dueDate: {
          $gte: new Date(from),
          $lte: new Date(to + "T23:59:59"),
        },
      });
    }

    if (assignedTo) {
      const assignedIds = assignedTo.split(",");
      filter.$and.push({
        assignedTo: { $in: assignedIds },
      });
    }

    const totalCount = await Task.countDocuments(filter);

    const tasks = await Task.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return success(reply, "Tasks fetched successfully", {
      tasks,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
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
    const { page = 1, limit = 10, search, status, from, to } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      assignedTo: userId,
    };

    const andConditions = [];

    if (search) {
      andConditions.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (status) {
      andConditions.push({ status });
    }

    if (from && to) {
      andConditions.push({
        dueDate: {
          $gte: new Date(from),
          $lte: new Date(to + "T23:59:59"),
        },
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const totalCount = await Task.countDocuments(filter);

    const tasks = await Task.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return success(reply, "My Tasks fetched successfully", {
      tasks,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
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
