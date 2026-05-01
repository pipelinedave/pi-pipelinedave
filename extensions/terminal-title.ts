import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let active = true;
  const state = {
    mode: "chat" as "chat" | "plan" | "build" | "review",
    activity: "ready" as "ready" | "thinking" | "tool" | "network" | "done",
    toolRunning: false,
    toolName: "",
    toolStart: 0,
    planSteps: { completed: 0, total: 0 },
  };

  // Set terminal title using OSC 0 sequence
  function setTerminalTitle(title: string) {
    // Clean title: remove newlines, control chars, truncate if too long
    const cleaned = title
      .replace(/[\n\r\t]/g, " ")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 200); // Prevent excessively long titles
    
    // OSC 0 = set icon name and title
    process.stdout.write(`\x1b]0;${cleaned}\x07`);
  }

  // Get short directory name
  function getShortDir(): string {
    try {
      const cwd = process.cwd();
      const home = process.env.HOME || "";
      
      // Replace home dir with ~
      let display = cwd;
      if (home && cwd.startsWith(home)) {
        display = "~" + cwd.slice(home.length);
      }
      
      // Show last 2-3 parts for brevity
      const parts = display.split("/").filter(Boolean);
      if (parts.length > 3) {
        return "..." + parts.slice(-3).join("/");
      }
      return display;
    } catch {
      return "";
    }
  }

  // Format tool name for display
  function formatToolName(name: string): string {
    // Extract key parts from tool name
    const parts = name.split("_");
    const keyWords = parts.slice(0, 2).map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
    return keyWords.join(" ");
  }

  // Build title based on current state
  function buildTitle(): string {
    const modeInfo = {
      chat: "CHAT",
      plan: "PLAN",
      build: "BUILD",
      review: "REVIEW",
    }[state.mode];

    const directory = getShortDir();
    let activityPart = "";
    
    // Build activity part based on state
    if (state.activity === "tool" && state.toolRunning) {
      const duration = Math.round((Date.now() - state.toolStart) / 1000);
      activityPart = `${formatToolName(state.toolName)} (${duration}s)`;
    } else if (state.activity === "thinking") {
      activityPart = "thinking";
    } else if (state.activity === "network") {
      activityPart = "waiting";
    } else if (state.mode === "plan" && state.planSteps.total > 0) {
      activityPart = `${state.planSteps.completed}/${state.planSteps.total} steps`;
    }

    // Build final title
    if (activityPart) {
      return `pi.dev: ${modeInfo} | ${activityPart} | ${directory}`;
    }
    return `pi.dev: ${modeInfo} | ${directory}`;
  }

  // Update terminal title
  function updateTitle() {
    if (!active) return;
    const title = buildTitle();
    setTerminalTitle(title);
  }

  // Event handlers
  pi.on("session_start", async () => {
    active = true;
    state.mode = "chat";
    state.activity = "ready";
    state.toolRunning = false;
    state.toolName = "";
    state.planSteps = { completed: 0, total: 0 };
    updateTitle();
  });

  pi.on("session_shutdown", () => {
    active = false;
    // Reset title to generic
    setTerminalTitle("terminal");
  });

  pi.on("turn_start", async () => {
    state.activity = "thinking";
    updateTitle();
  });

  pi.on("message_update", async () => {
    updateTitle();
  });

  pi.on("tool_execution_start", async (event: any) => {
    state.toolRunning = true;
    state.toolName = event.toolName || "unknown";
    state.toolStart = Date.now();
    state.activity = "tool";
    updateTitle();
  });

  pi.on("tool_execution_end", async () => {
    state.toolRunning = false;
    state.toolName = "";
    state.activity = "done";
    
    // Reset to ready after 2 seconds
    const resetAt = Date.now() + 2000;
    const checkReset = async () => {
      if (active && state.activity === "done" && Date.now() > resetAt) {
        state.activity = "ready";
        updateTitle();
        pi.off("turn_start", checkReset);
      }
    };
    pi.on("turn_start", checkReset);
  });

  pi.on("before_provider_request", async () => {
    state.activity = "network";
    updateTitle();
  });

  pi.on("after_provider_response", async () => {
    state.activity = "thinking";
    updateTitle();
  });

  // Listen for mode changes from context
  pi.on("context_update", async (event: any) => {
    if (event.mode) {
      state.mode = event.mode;
      updateTitle();
    }
    if (event.planSteps) {
      state.planSteps = event.planSteps;
      updateTitle();
    }
  });

  // Listen for plan step updates
  pi.on("plan_step_added", async (event: any) => {
    state.planSteps.total++;
    updateTitle();
  });

  pi.on("plan_step_completed", async (event: any) => {
    state.planSteps.completed++;
    updateTitle();
  });

  // Periodic update for tool duration timer (every second while tool is running)
  const toolInterval = setInterval(() => {
    if (state.toolRunning && active) {
      updateTitle();
    }
  }, 1000);

  // Cleanup on shutdown
  pi.on("session_shutdown", () => {
    clearInterval(toolInterval);
    active = false;
    setTerminalTitle("terminal");
  });
}
