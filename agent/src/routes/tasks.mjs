import { Router } from "express";
import { getTask } from "../services/taskQueue.mjs";

const router = Router();

router.get("/tasks/:taskId", (req, res) => {
  const task = getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const response = {
    taskId: task.id,
    type: task.type,
    status: task.status,
    description: task.description,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  };

  if (task.status === "completed") {
    response.result = task.result;
  }
  if (task.status === "rejected") {
    response.rejectReason = task.rejectReason;
  }

  res.json(response);
});

export default router;
