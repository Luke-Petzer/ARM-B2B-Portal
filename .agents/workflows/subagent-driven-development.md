---
description: "Use when executing implementation plans with independent tasks. Dispatches fresh context per task with two-stage review."
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Why subagents:** Delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused. They should never inherit the session's context or history — construct exactly what they need.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

## When to Use

- You have an implementation plan with independent tasks
- Tasks are mostly independent (can be done sequentially without tight coupling)

## The Process

1. **Read plan, extract all tasks** with full text, note context
2. **For each task:**
   - Dispatch implementer (browser subagent or inline execution) with full task text + context
   - If implementer asks questions → answer, provide context, re-dispatch
   - Implementer implements, tests, commits, self-reviews
   - **Stage 1 — Spec compliance review:** Confirm code matches spec. If issues → fix → re-review
   - **Stage 2 — Code quality review:** Confirm code quality. If issues → fix → re-review
   - Mark task complete
3. **After all tasks:** Final code review of entire implementation
4. **Use `/finishing-a-development-branch`** workflow to complete

## Model/Effort Selection

Use the least powerful model that can handle each role:

| Task Type | Effort Level |
|-----------|-------------|
| Mechanical (1-2 files, clear spec) | Fast, cheap |
| Integration (multi-file, patterns) | Standard |
| Architecture, design, review | Most capable |

## Handling Implementer Status

| Status | Action |
|--------|--------|
| **DONE** | Proceed to spec compliance review |
| **DONE_WITH_CONCERNS** | Read concerns, address if about correctness, then review |
| **NEEDS_CONTEXT** | Provide missing context and re-dispatch |
| **BLOCKED** | Assess: more context? More capable model? Break task smaller? Escalate to human? |

**Never** ignore an escalation or force retry without changes.

## Advantages

- Fresh context per task (no confusion)
- Two-stage review catches issues early
- Spec compliance prevents over/under-building
- Questions surfaced before work begins

## Red Flags

**Never:**

- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Start code quality review before spec compliance is ✅
- Move to next task while review has open issues

**Always:**

- Provide full task text (don't make subagent read plan file)
- Answer subagent questions before letting them proceed
- Re-review after fixes
- Use `/finishing-a-development-branch` when all tasks complete

## Integration

- **Preceded by:** `/writing-plans` (creates the plan)
- **Uses:** `/test-driven-development` (subagents follow TDD for each task)
- **Followed by:** `/finishing-a-development-branch` (cleanup after all tasks)
