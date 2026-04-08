const STATE = {
  IDLE: "idle",
  WAITING_TASK_SELECTION: "waiting_task_selection",
  WAITING_FILE_UPLOAD: "waiting_file_upload",
  WAITING_ASSIGNEE: "waiting_assignee",
  WAITING_CREATE_TITLE: "waiting_create_title",
  WAITING_CREATE_DUEDATE: "waiting_create_duedate",
};

function deriveConversationState(draft = null, hasUploadedFile = false) {
  if (!draft?.tool) return STATE.IDLE;

  if (draft.tool === "updateTaskFile") {
    if (!draft.input?.taskId) return STATE.WAITING_TASK_SELECTION;
    if (!hasUploadedFile) return STATE.WAITING_FILE_UPLOAD;
  }

  if (draft.tool === "assignTask") {
    if (!draft.input?.taskId) return STATE.WAITING_TASK_SELECTION;
    if (!draft.input?.assigneeQuery) return STATE.WAITING_ASSIGNEE;
  }

  if (draft.tool === "createSimpleTask") {
    if (!draft.input?.title) return STATE.WAITING_CREATE_TITLE;
    if (!draft.input?.dueDate) return STATE.WAITING_CREATE_DUEDATE;
  }

  return STATE.IDLE;
}

module.exports = {
  STATE,
  deriveConversationState,
};
