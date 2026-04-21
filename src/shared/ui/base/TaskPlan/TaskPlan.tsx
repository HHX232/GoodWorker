"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// ─── Brand tokens ───────────────────────────────────────────────
const brand = {
  bg: "#EEEFF8",
  card: "#ffffff",
  border: "rgba(20,20,22,0.1)",
  text: "#141416",
  textMuted: "rgba(20,20,22,0.45)",
  accent: "linear-gradient(135deg, #ff7a00 0%, #bd00ff 100%)",
  accentStart: "#ff7a00",
  accentEnd: "#bd00ff",
  hoverBg: "rgba(20,20,22,0.04)",
  // status colors kept readable on light bg
  green: { bg: "#e6f9ef", text: "#1a7a45" },
  blue:  { bg: "#e6f0ff", text: "#1a4fa8" },
  yellow:{ bg: "#fff8e1", text: "#8a6200" },
  red:   { bg: "#fde8e8", text: "#b91c1c" },
  muted: { bg: "rgba(20,20,22,0.07)", text: "rgba(20,20,22,0.45)" },
};

// ─── Types ───────────────────────────────────────────────────────
interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[];
}
interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level: number;
  dependencies: string[];
  subtasks: Subtask[];
}

// ─── Data ────────────────────────────────────────────────────────
const initialTasks: Task[] = [
  {
    id: "1", title: "Research Project Requirements",
    description: "Gather all necessary information about project scope and requirements",
    status: "in-progress", priority: "high", level: 0, dependencies: [],
    subtasks: [
      { id: "1.1", title: "Interview stakeholders", description: "Conduct interviews with key stakeholders to understand needs", status: "completed", priority: "high", tools: ["communication-agent", "meeting-scheduler"] },
      { id: "1.2", title: "Review existing documentation", description: "Go through all available documentation and extract requirements", status: "in-progress", priority: "medium", tools: ["file-system", "browser"] },
      { id: "1.3", title: "Compile findings report", description: "Create a comprehensive report of all gathered information", status: "need-help", priority: "medium", tools: ["file-system", "markdown-processor"] },
    ],
  },
  {
    id: "2", title: "Design System Architecture",
    description: "Create the overall system architecture based on requirements",
    status: "in-progress", priority: "high", level: 0, dependencies: [],
    subtasks: [
      { id: "2.1", title: "Define component structure", description: "Map out all required components and their interactions", status: "pending", priority: "high", tools: ["architecture-planner", "diagramming-tool"] },
      { id: "2.2", title: "Create data flow diagrams", description: "Design diagrams showing how data will flow through the system", status: "pending", priority: "medium", tools: ["diagramming-tool", "file-system"] },
      { id: "2.3", title: "Document API specifications", description: "Write detailed specifications for all APIs in the system", status: "pending", priority: "high", tools: ["api-designer", "openapi-generator"] },
    ],
  },
  {
    id: "3", title: "Implementation Planning",
    description: "Create a detailed plan for implementing the system",
    status: "pending", priority: "medium", level: 1, dependencies: ["1", "2"],
    subtasks: [
      { id: "3.1", title: "Resource allocation", description: "Determine required resources and allocate them to tasks", status: "pending", priority: "medium", tools: ["project-manager", "resource-calculator"] },
      { id: "3.2", title: "Timeline development", description: "Create a timeline with milestones and deadlines", status: "pending", priority: "high", tools: ["timeline-generator", "gantt-chart-creator"] },
      { id: "3.3", title: "Risk assessment", description: "Identify potential risks and develop mitigation strategies", status: "pending", priority: "medium", tools: ["risk-analyzer"] },
    ],
  },
  {
    id: "4", title: "Development Environment Setup",
    description: "Set up all necessary tools and environments for development",
    status: "in-progress", priority: "high", level: 0, dependencies: [],
    subtasks: [
      { id: "4.1", title: "Install development tools", description: "Set up IDEs, version control, and other necessary development tools", status: "pending", priority: "high", tools: ["shell", "package-manager"] },
      { id: "4.2", title: "Configure CI/CD pipeline", description: "Set up continuous integration and deployment pipelines", status: "pending", priority: "medium", tools: ["github-actions", "gitlab-ci"] },
      { id: "4.3", title: "Set up testing framework", description: "Configure automated testing frameworks for the project", status: "pending", priority: "high", tools: ["test-runner", "shell"] },
    ],
  },
  {
    id: "5", title: "Initial Development Sprint",
    description: "Execute the first development sprint based on the plan",
    status: "pending", priority: "medium", level: 1, dependencies: ["4"],
    subtasks: [
      { id: "5.1", title: "Implement core features", description: "Develop the essential features identified in the requirements", status: "pending", priority: "high", tools: ["code-assistant", "github", "file-system"] },
      { id: "5.2", title: "Perform unit testing", description: "Create and execute unit tests for implemented features", status: "pending", priority: "medium", tools: ["test-runner", "code-coverage-analyzer"] },
      { id: "5.3", title: "Document code", description: "Create documentation for the implemented code", status: "pending", priority: "low", tools: ["documentation-generator"] },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
function statusColors(status: string) {
  switch (status) {
    case "completed":  return brand.green;
    case "in-progress":return brand.blue;
    case "need-help":  return brand.yellow;
    case "failed":     return brand.red;
    default:           return brand.muted;
  }
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const s = { width: size, height: size };
  if (status === "completed")   return <CheckCircle2  style={{ ...s, color: brand.green.text }} />;
  if (status === "in-progress") return <CircleDotDashed style={{ ...s, color: brand.blue.text }} />;
  if (status === "need-help")   return <CircleAlert   style={{ ...s, color: brand.yellow.text }} />;
  if (status === "failed")      return <CircleX       style={{ ...s, color: brand.red.text }} />;
  return <Circle style={{ ...s, color: brand.textMuted }} />;
}

// ─── Component ───────────────────────────────────────────────────
export default function TaskPlan() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<{ [key: string]: boolean }>({});

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const toggleTaskExpansion = (id: string) =>
    setExpandedTasks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTaskStatus = (taskId: string) => {
    const statuses = ["completed", "in-progress", "pending", "need-help", "failed"];
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
        return {
          ...task,
          status: newStatus,
          subtasks: task.subtasks.map((s) => ({
            ...s,
            status: newStatus === "completed" ? "completed" : s.status,
          })),
        };
      })
    );
  };

  const toggleSubtaskStatus = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const updatedSubtasks = task.subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, status: s.status === "completed" ? "pending" : "completed" }
            : s
        );
        const allDone = updatedSubtasks.every((s) => s.status === "completed");
        return { ...task, subtasks: updatedSubtasks, status: allDone ? "completed" : task.status };
      })
    );
  };

  // Animation variants
  const ease = [0.2, 0.65, 0.3, 0.9] as const;

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 500, damping: 30 } },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -5, transition: { duration: 0.15 } },
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { height: "auto", opacity: 1, overflow: "visible", transition: { duration: 0.25, staggerChildren: 0.05, when: "beforeChildren", ease } },
    exit:    { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.2, ease } },
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 500, damping: 25 } },
    exit: { opacity: 0, x: prefersReducedMotion ? 0 : -10, transition: { duration: 0.15 } },
  };

  const detailsVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { opacity: 1, height: "auto", overflow: "visible", transition: { duration: 0.25, ease } },
  };

  return (
    <div style={{ background: brand.bg, height: "100%", overflow: "auto", padding: 8, fontFamily: "system-ui, sans-serif" }}>
      <motion.div
        style={{
          background: brand.card,
          border: `1px solid ${brand.border}`,
          borderRadius: 12,
          boxShadow: "0 1px 4px rgba(20,20,22,0.07)",
          overflow: "hidden",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
      >
        <LayoutGroup>
          <div style={{ padding: 16, overflow: "hidden" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";
                const sc = statusColors(task.status);

                return (
                  <motion.li
                    key={task.id}
                    style={{ marginTop: index !== 0 ? 4 : 0, paddingTop: index !== 0 ? 8 : 0 }}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    {/* Task row */}
                    <motion.div
                      style={{ display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
                      whileHover={{ backgroundColor: brand.hoverBg }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Status icon */}
                      <motion.div
                        style={{ marginRight: 8, flexShrink: 0 }}
                        onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                            transition={{ duration: 0.2, ease }}
                          >
                            <StatusIcon status={task.status} size={17} />
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      {/* Title + badges */}
                      <motion.div
                        style={{ display: "flex", flexGrow: 1, minWidth: 0, alignItems: "center", justifyContent: "space-between" }}
                        onClick={() => toggleTaskExpansion(task.id)}
                      >
                        <span style={{
                          color: isCompleted ? brand.textMuted : brand.text,
                          textDecoration: isCompleted ? "line-through" : "none",
                          fontSize: 14,
                          fontWeight: 500,
                          flexGrow: 1,
                          marginRight: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {task.title}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {/* Dependency badges */}
                          {task.dependencies.length > 0 && (
                            <div style={{ display: "flex", gap: 4 }}>
                              {task.dependencies.map((dep, i) => (
                                <motion.span
                                  key={i}
                                  style={{
                                    background: "rgba(20,20,22,0.07)",
                                    color: brand.textMuted,
                                    borderRadius: 4,
                                    padding: "1px 6px",
                                    fontSize: 10,
                                    fontWeight: 500,
                                  }}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.05 }}
                                >
                                  {dep}
                                </motion.span>
                              ))}
                            </div>
                          )}

                          {/* Status badge */}
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={task.status}
                              style={{
                                background: sc.bg,
                                color: sc.text,
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              transition={{ duration: 0.2 }}
                            >
                              {task.status}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    </motion.div>

                    {/* Subtasks */}
                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div
                          style={{ position: "relative", overflow: "hidden" }}
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          layout
                        >
                          {/* Connecting dashed line */}
                          <div style={{
                            position: "absolute",
                            top: 0, bottom: 0,
                            left: 20,
                            borderLeft: `2px dashed ${brand.border}`,
                          }} />

                          <ul style={{ listStyle: "none", margin: "4px 8px 6px 12px", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                            {task.subtasks.map((subtask) => {
                              const key = `${task.id}-${subtask.id}`;
                              const isSubExpanded = expandedSubtasks[key];
                              const ssc = statusColors(subtask.status);

                              return (
                                <motion.li
                                  key={subtask.id}
                                  style={{ display: "flex", flexDirection: "column", padding: "2px 0 2px 24px" }}
                                  onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                  variants={subtaskVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  layout
                                >
                                  <motion.div
                                    style={{ display: "flex", alignItems: "center", borderRadius: 6, padding: 4 }}
                                    whileHover={{ backgroundColor: brand.hoverBg }}
                                    transition={{ duration: 0.15 }}
                                    layout
                                  >
                                    {/* Subtask status icon */}
                                    <motion.div
                                      style={{ marginRight: 8, flexShrink: 0 }}
                                      onClick={(e) => { e.stopPropagation(); toggleSubtaskStatus(task.id, subtask.id); }}
                                      whileTap={{ scale: 0.9 }}
                                      whileHover={{ scale: 1.1 }}
                                      layout
                                    >
                                      <AnimatePresence mode="wait">
                                        <motion.div
                                          key={subtask.status}
                                          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                          exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                          transition={{ duration: 0.2 }}
                                        >
                                          <StatusIcon status={subtask.status} size={14} />
                                        </motion.div>
                                      </AnimatePresence>
                                    </motion.div>

                                    <span style={{
                                      fontSize: 13,
                                      color: subtask.status === "completed" ? brand.textMuted : brand.text,
                                      textDecoration: subtask.status === "completed" ? "line-through" : "none",
                                      cursor: "pointer",
                                    }}>
                                      {subtask.title}
                                    </span>
                                  </motion.div>

                                  {/* Subtask details */}
                                  <AnimatePresence mode="wait">
                                    {isSubExpanded && (
                                      <motion.div
                                        style={{
                                          marginTop: 4,
                                          marginLeft: 6,
                                          paddingLeft: 16,
                                          borderLeft: `1px dashed ${brand.border}`,
                                          overflow: "hidden",
                                        }}
                                        variants={detailsVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="hidden"
                                        layout
                                      >
                                        <p style={{ fontSize: 12, color: brand.textMuted, margin: "4px 0" }}>
                                          {subtask.description}
                                        </p>

                                        {subtask.tools && subtask.tools.length > 0 && (
                                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                            <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 600 }}>
                                              MCP Servers:
                                            </span>
                                            {subtask.tools.map((tool, i) => (
                                              <motion.span
                                                key={i}
                                                style={{
                                                  // Gradient border trick via background + padding
                                                  background: "rgba(20,20,22,0.06)",
                                                  color: brand.text,
                                                  borderRadius: 4,
                                                  padding: "1px 7px",
                                                  fontSize: 10,
                                                  fontWeight: 500,
                                                  border: `1px solid ${brand.border}`,
                                                }}
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                                                whileHover={{ y: -1 }}
                                              >
                                                {tool}
                                              </motion.span>
                                            ))}
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}