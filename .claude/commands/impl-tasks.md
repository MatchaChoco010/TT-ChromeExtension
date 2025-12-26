---
description: Execute all pending spec tasks sequentially with clean context per task
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task
argument-hint: <feature-name>
---

# Sequential Task Executor with Clean Context

<background_information>
- **Mission**: Execute all pending implementation tasks for a specification sequentially, using a fresh subagent with clean context for each task
- **Success Criteria**:
  - All pending tasks executed one by one
  - Each task runs in isolated clean context
  - Task summaries collected and displayed
  - All tasks marked as completed in tasks.md
</background_information>

<instructions>
## Core Task
Execute all pending tasks for feature **$1** sequentially, with each task running in a fresh subagent to prevent context pollution and overflow.

## Execution Steps

### Step 1: Load Project Configuration

**Read CLAUDE.md to get directory paths**:
- Read `CLAUDE.md` file from project root
- Extract Specs directory path from "### Paths" section (line starting with "- Specs:")
- Extract the path from backticks (e.g., `` `.kiro/specs/` `` → `.kiro/specs`)
- Store as `$SPECS_DIR` variable for use in subsequent steps
- If CLAUDE.md not found or Specs path not defined, fallback to `.kiro/specs`

**Example extraction**:
```
From: "- Specs: `.kiro/specs/`"
Extract: ".kiro/specs"

From: "- Specs: `docs/specs/`" (project customized)
Extract: "docs/specs"
```

### Step 2: Load Spec Context and Find Pending Tasks

**Read necessary files using extracted path**:
- `$SPECS_DIR/$1/spec.json`
- `$SPECS_DIR/$1/tasks.md`

**Validate setup**:
- Verify spec exists at `$SPECS_DIR/$1/`
- Verify tasks are approved in spec.json
- If tasks not approved, stop and suggest running `/kiro:spec-tasks $1`

**Parse tasks.md to identify all uncompleted tasks**:
- Use Grep to find lines with `- [ ]` pattern in `$SPECS_DIR/$1/tasks.md`
- Extract task numbers from lines matching pattern `- [ ]\*? \d+\.\d+` (includes optional tasks marked with `*`)
- Create ordered list of pending task numbers in sequential order
- Include ALL uncompleted tasks regardless of optional marker
- Example pending task: `- [ ] 5.2 新規タブの親子関係構築` → extract "5.2"
- Example optional task: `- [ ]* 4.4 基本UI表示のテスト` → extract "4.4" (NOT skipped)
- Example completed task: `- [x] 1.1 (P) プロジェクト初期化` → skip
- Example completed optional: `- [x]* 3.2 テストカバレッジ` → skip

**If no pending tasks found**:
- Report "✅ All tasks completed!" and exit successfully

### Step 3: Display Initial Status

**Show execution plan**:
- Count total pending tasks
- List all task numbers that will be executed
- Display initial status message (see Output Description format)

### Step 4: Execute Tasks Sequentially

**For each pending task number**:

1. **Display Task Info**:
   - Extract task description from `$SPECS_DIR/$1/tasks.md` line matching task number
   - Output is rendered as Markdown, so use proper Markdown line breaks
   - Output the following with **two spaces at the end of each line** or **blank lines between paragraphs**:

     ```
     (blank line for paragraph break)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     📌 Task {task-number}/{total}: {task-description}
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     🔄 Launching clean subagent...
     (blank line for paragraph break)
     ```

   - CRITICAL: Add two trailing spaces (  ) at the end of each line for Markdown line breaks
   - OR: Separate each line with blank lines to create distinct paragraphs

2. **Launch Clean Subagent**:
   - Use Task tool with subagent_type="general-purpose"
   - DO NOT use `resume` parameter - each task gets fresh context
   - Set description: "Execute task {task-number}"
   - Pass detailed prompt:
     ```
     You are executing implementation task {task-number} for feature '{feature-name}' in a spec-driven development workflow.

     Your task:
     1. Use the Skill tool to execute: skill='kiro:spec-impl', args='{feature-name} {task-number}'
     2. Wait for the skill to complete
     3. Extract and return ONLY:
        - The final test execution results (test pass/fail output)
        - The final summary section
     4. DO NOT include the step-by-step implementation process

     Important: Return only the test results and summary, not the full execution log.
     ```

3. **Collect and Display Output**:
   - Wait for subagent to complete (Task tool is blocking)
   - Capture the subagent's output (test results + summary)
   - Output with proper Markdown formatting:

     ```
     (blank line)
     {captured output from subagent}
     (blank line)
     ✅ Task {task-number} completed
     ```

   - CRITICAL: Use blank lines to separate sections (Markdown paragraph breaks)
   - Ensure proper spacing for readability in Markdown rendering

4. **Verify Task Completion**:
   - Re-read `$SPECS_DIR/$1/tasks.md` to verify task is marked as `[x]`
   - If task still shows `[ ]`, log warning but continue
   - This verification helps catch any issues early

5. **Continue to Next Task**:
   - Move to next pending task
   - Repeat process with NEW subagent (clean context)
   - Each iteration is completely independent

### Step 5: Final Report

**After all tasks completed**:
- Display completion summary with visual separator (see Output Description format)
- List all task numbers that were executed
- Show total count
- Suggest next steps:
  - `/kiro:validate-impl $1` - Validate the implementation
  - `/kiro:spec-status $1` - Check overall project status

## Critical Constraints

- **Clean Context**: Each task MUST run in new subagent (no resume)
- **Sequential Only**: One task at a time, in order
- **No Skipping**: All pending tasks must be attempted, including optional tasks marked with `*`
- **Concise Output**: Display only test results and summary from subagents, not full execution log
- **Proper Formatting**: Use blank lines to separate sections for readability
- **Error Handling**: If a task fails, report it and stop (don't continue to next)

## Tool Guidance

- **Read**: Load CLAUDE.md first, then spec.json and tasks.md from discovered paths
- **Grep**: Extract Specs path from CLAUDE.md, find pending tasks in tasks.md
- **Task**: Launch fresh subagent for each task (general-purpose type)
- **Never resume**: Each Task call must create new agent

## Output Description

Provide updates in the language specified in spec.json:

**Initial status** (at start):
```
📋 Found {count} pending tasks for feature '{feature-name}'
Tasks to execute: {task-numbers}

Starting sequential execution with clean context per task...
```

**During execution** (per task):
- **CRITICAL**: Output is rendered as Markdown - use proper line breaks
- **Method 1**: Add two trailing spaces at end of each line for hard line break
- **Method 2**: Separate sections with blank lines (paragraph breaks)
- Example output format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Task 13.1/15: SettingsPanel コンポーネントの実装
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Launching clean subagent...

{test execution results}

{summary section}

✅ Task 13.1 completed
```

Note: Each line ending with `  ` (two spaces) creates a hard line break in Markdown.
Blank lines create paragraph breaks.

**Final summary**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 All tasks completed successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Executed tasks: {task-numbers}
Total: {count} tasks

✨ Next steps:
• Run /kiro:validate-impl {feature-name} to validate implementation
• Run /kiro:spec-status {feature-name} to check overall progress
```

**Format**:
- Clear progress updates with visual separators
- Use Markdown line breaks: two trailing spaces (  ) or blank lines for paragraph breaks
- Test results + concise summaries only (no step-by-step logs)
- All output is rendered as Markdown in VSCode

## Safety & Fallback

### Error Scenarios

**CLAUDE.md Not Found**:
- **Fallback**: Use default path `.kiro/specs`
- **Warning**: "CLAUDE.md not found, using default specs path: .kiro/specs"

**Spec Not Found**:
- **Stop Execution**: Spec must exist
- **Message**: "Feature '$1' not found in {specs-path}/"
- **Action**: "Check feature name or run `/kiro:spec-init` first"

**Tasks Not Approved**:
- **Stop Execution**: Tasks must be approved
- **Message**: "Tasks not approved for feature '$1'"
- **Action**: "Run `/kiro:spec-tasks $1` and approve tasks first"

**Task Execution Failure**:
- **Stop Execution**: Don't continue if task fails
- **Message**: "Task {task-number} failed with error: {error}"
- **Action**: "Review error, fix issue, then re-run `/impl-tasks $1`"

**No Pending Tasks**:
- **Normal Exit**: All tasks already completed
- **Message**: "✅ All tasks are already completed for feature '$1'"

### Usage Examples

**Execute all pending tasks**:
- `/impl-tasks my-feature`

**After completion**:
- `/kiro:validate-impl my-feature` - Validate implementation
- `/kiro:spec-status my-feature` - Check overall status

think
