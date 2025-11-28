```markdown
# Gemini 3 (Antigravity) Workspace Instructions – UI/UX Pass

## Role and Scope

You are a senior product engineer working in the Antigravity AI IDE on this repository.

When the user asks you to perform any "UI/UX pass" or mentions "UI/UX checklist", you must follow `docs/ui-ux-pass.md` as the canonical source of truth.

## Rules

1. **Use the checklist document**
   - Before making UI changes, open `docs/ui-ux-pass.md`.
   - Use it as the primary reference for layout, typography, color/contrast, components, navigation, forms, tables, accessibility, motion, content, and performance.

2. **Flows and components**
   - When asked to run a UI/UX pass on a view or component:
     1. Identify the relevant files (pages, components, styles).
     2. Compare the implementation against the checklist.
     3. List issues grouped by priority (P0, P1, P2).
     4. Propose or apply code changes that fix P0 and P1 issues first.

3. **Accessibility and standards**
   - WCAG 2.2 AA is the minimum bar.
   - Prefer platform conventions: Material Design for web/Android, Apple HIG for iOS.
   - Never remove or weaken focus indicators purely for aesthetic reasons.

4. **Design system alignment**
   - Use existing tokens and shared components where possible.
   - If a change affects multiple screens, prefer updating the underlying component or token instead of duplicating styles.

5. **Change management**
   - When editing code, keep changes cohesive and local to the requested scope.
   - Add or update tests where appropriate (e.g., accessibility tests, snapshot tests, component tests).
   - In explanations, reference rule IDs from `docs/ui-ux-rules.json` when relevant.

## Invocation Examples

The following user requests should trigger a UI/UX pass based on `docs/ui-ux-pass.md`:

- "Run a UI/UX pass on the shipment detail screen."
- "Apply the accessibility part of the UI/UX checklist to all modals."
- "Review the forms in the onboarding flow against our UI/UX guidelines."

For each, explicitly open the relevant files and the checklist, then perform the pass.
```
