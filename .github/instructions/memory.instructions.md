---
applyTo: '**' 

---

### Hierarchical Memory Tool Instructions

**Token Efficiency Rule**: Only load memory that's relevant to current task context.

---

**1. Session Start Protocol**

Always begin with: **"Remembering..."** then execute:

```
search_nodes("session_context")  # Get last session state
search_nodes("task_node")        # Get task tree current state
```

**Parse the results to identify:**

- Current active task (status: in_progress)
- Suspended tasks (status: suspended)
- Next priority tasks (status: not_started)

**If unclear current position:** Ask human "Which task should I focus on?"

---

**2. Memory Categories & Entity Types**

**a) Project Constellation (entityType: "project_constellation")**

- Create ONCE per project, never modify
- Contains: project identity, core constraints, success criteria
- Load: Only when starting new project or major architecture changes

**b) Strategic Memory (entityType: "strategic_plan")**

- Current architectural approach (your "Option 1 Do Less Get More")
- Technology stack decisions
- Load: At session start if architecture questions arise

**c) Task Hierarchy (entityType: "task_node")**

- **Always track:** status, parent/child relationships, local context
- **Load pattern:** Current task + immediate children + parent context
- **Update frequency:** Every significant progress or discovery

**d) Session Context (entityType: "session_context")**

- **Critical for handoffs:** current position, next actions, blockers
- **Create:** At end of every session
- **Load:** At start of every session

**e) Tool Registry (entityType: "tool_registry")**

- Available commands, usage patterns, integration approaches
- **Load:** Only when encountering unknown tools or error patterns

**f) Rules (entityType: "rule_set")**

- Code standards, testing requirements, quality gates
- **Load:** When writing code or reviewing standards

---

**3. Task Tree Navigation Commands**

**Find current work:**

```
search_nodes("status: in_progress")
```

**Create child task (for ad-hoc work):**

```
create_entities([{
  name: "ChildTask_YYYY-MM-DD",
  entityType: "task_node",
  observations: ["status: not_started", "parent_context: [parent_name]"]
}])
create_relations([{from: "ChildTask_YYYY-MM-DD", to: "ParentTask", relationType: "child_of"}])
```

**Complete and bubble up:**

```
add_observations([{
  entityName: "completed_task",
  contents: ["status: completed", "outcomes: [what was accomplished]"]
}])
# Then check parent task progress
```

**Context switch (temporary):**

```
add_observations([{entityName: "current_task", contents: ["status: suspended"]}])
# Work on other task
# Later: add_observations([{entityName: "current_task", contents: ["status: in_progress"]}])
```

---

**4. Token Efficiency Guidelines**

**Load Minimally:**

- Current task + 1 level up + 1 level down in hierarchy
- Only load strategic/rules memory when needed for current work
- Use `open_nodes([specific_names])` instead of `read_graph()` for focused loading

**Update Frequently:**

- Task progress and local context on every significant finding
- Session context before any major transition
- Strategic memory only on architecture decisions

**Clean Periodically:**

- Mark completed tasks clearly
- Archive old session contexts (keep last 3-5)
- Consolidate related observations to reduce noise

---
