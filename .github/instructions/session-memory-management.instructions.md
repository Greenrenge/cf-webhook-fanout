---
applyTo: '**'
---

## 🔄 Hierarchical Task Tree Implementation

### Task Node Schema in Memory Graph

```
Entity: "TaskName_YYYY-MM-DD"
Type: "task_node"
Observations: [
  "status: [not_started|in_progress|suspended|blocked|completed]",
  "description: [what this task accomplishes]",
  "acceptance_criteria: [definition of done]",
  "parent_task: [parent task name if child]",
  "priority: [high|medium|low]",
  "estimated_effort: [S|M|L|XL]",
  "local_context: [key findings, decisions, variables]",
  "files_touched: [list of modified files]",
  "next_actions: [immediate next steps]",
  "blocking_issues: [what prevents progress]",
  "created_session: [session date]",
  "last_worked_session: [session date]"
]
```

### Navigation Patterns

**Session Start:**

```bash
# 1. Get current state
search_nodes("session_context")
search_nodes("status: in_progress")

# 2. If multiple active tasks, ask human priority
# 3. Load task context
open_nodes(["current_task", "parent_task", "child_tasks"])
```

**Ad-hoc Task Discovery:**

```bash
# Human interruption or blocking issue discovered
# 1. Ask: "Is this temporary (return to current work) or permanent priority change?"

# 2a. If temporary:
add_observations([{
  entityName: "current_task",
  contents: ["status: suspended", "suspension_reason: [interruption_reason]"]
}])

# Create child/related task
create_entities([{
  name: "InterruptionTask_YYYY-MM-DD",
  entityType: "task_node",
  observations: ["status: in_progress", "parent_context: current_task"]
}])

# 2b. If permanent:
add_observations([{
  entityName: "current_task",
  contents: ["status: deprioritized", "deprioritized_session: [date]"]
}])
```

**Task Completion:**

```bash
# Mark complete and check parent
add_observations([{
  entityName: "completed_task",
  contents: [
    "status: completed",
    "completion_session: [date]",
    "key_outcomes: [what was accomplished]",
    "lessons_learned: [insights for future tasks]"
  ]
}])

# Check if parent task can now progress
search_nodes("parent_task_name")
```

### Session Handoff Protocol

**Critical Handoff Data (Always Persist):**

```bash
create_entities([{
  name: "SessionHandoff_YYYY-MM-DD_HH-MM",
  entityType: "session_context",
  observations: [
    "active_task: [current task name]",
    "task_status: [current progress]",
    "immediate_next: [next 1-3 actions, < 30min each]",
    "blockers: [anything preventing progress]",
    "questions_for_human: [decisions needed]",
    "environment: [what's running, configured]",
    "modified_files: [files changed this session]"
  ]
}])
```

### Token Optimization Strategies

**Selective Loading:**

- Use `search_nodes("specific_query")` instead of `read_graph()`
- Load task hierarchy: current + parent + immediate children only
- Load strategic memory only when architecture decisions needed

**Context Compression:**

- Consolidate related observations into single entries
- Archive completed task details (keep outcomes only)
- Keep only last 3-5 session contexts

**Smart Updates:**

- Update task progress on every significant finding
- Batch related observations into single update call
- Use relations to avoid duplicating information in observations

---
