# Product Requirements Document (PRD) Creation Plan

## Overview
The goal is to generate a comprehensive Product Requirements Document (PRD) that outlines all the features intended to be implemented in the `tradeshift_engine` project. We need to document the *intended* functionality of all features, ignoring any current broken states or bugs.

## Project Type
WEB / BACKEND (Documentation Task for Full-Stack Application)

## Success Criteria
- A highly detailed `PRD.md` document is created.
- The PRD covers all major domains of the project (e.g., Auth, Community/Chat, Market Replay Engine, Portfolio/Trading logs, and ML/AI Bias classifiers).
- The document accurately describes the "wanted" state of the features rather than their broken state.

## Tech Stack
- Markdown (`PRD.md`)

## File Structure
- `PRD.md` (To be created in the project root)

## Socratic Gate (Context & Clarification)
Before implementation, please consider these questions:
1. **Scope:** Should the PRD strictly focus on user-facing product features, or should it also include the technical/infrastructure definitions (like Postgres Partitioning, Redis caching, MinIO parquet loading, and RabbitMQ pipelines)?
2. **Missing Features:** Are there any entirely unstarted features (no code yet) that you want me to include as "intended" features?

## Task Breakdown

### Task 1: Codebase Survey & Feature Extraction
- **Agent:** `explorer-agent` / `backend-specialist`
- **Skills:** `brainstorming`, `documentation-templates`
- **Priority:** P0
- **INPUT:** Survey FastAPI routing files, Next.js/React frontend pages, and recent conversation logs.
- **OUTPUT:** A summarized and categorized list of all intended features.
- **VERIFY:** Review the list to confirm all major domains are covered (Auth, Market Replay, Trading, Community, ML).

### Task 2: PRD Drafting
- **Agent:** `orchestrator`
- **Skills:** `plan-writing`, `documentation-templates`
- **Priority:** P1
- **Dependencies:** Task 1
- **INPUT:** Categorized feature list.
- **OUTPUT:** Draft the `PRD.md` file detailing user flows, mechanisms (e.g., WhatsApp-style chat timestamps, Market Simulation timing), and core features.
- **VERIFY:** The PRD is fully documented and ignores current "broken" states as requested.

## Phase X: Verification
- [ ] Read `PRD.md` to ensure it is grammatically correct and clearly formatted.
- [ ] Final check against known features from recent workspace conversations.
- [ ] User review and approval of the generated PRD.
