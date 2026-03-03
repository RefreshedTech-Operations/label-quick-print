

# Per-User Milestone Celebrations on the Scan Page

## What will change

After each successful print on the Scan page, the app will query the current user's total prints for the day. When they hit exactly 250 or 500, a full-screen celebratory overlay appears with the specified messages, auto-dismissing after 5 seconds.

## Technical Details

### 1. New component: `src/components/MilestoneCelebration.tsx`
- Full-screen overlay with semi-transparent backdrop
- Scale-in bounce animation via custom CSS keyframe
- Floating emoji particles for visual flair
- Props: `milestone: number`, `message: string`, `onDismiss: () => void`
- Auto-dismisses after 5 seconds, or tap/click to dismiss early
- Messages:
  - **250**: "250 Labels Printed! -- keep it going! 🔥"
  - **500**: "500 Labels Printed! You're Killing it! -- amazing work! 🏆"

### 2. Changes in `src/pages/Scan.tsx`
- New state: `celebratedMilestones: Set<number>` (session-scoped, resets on page reload)
- New state: `activeCelebration: { milestone: number; message: string } | null`
- New helper function `checkMilestone(userId: string)`:
  - Queries: `SELECT COUNT(*) FROM shipments WHERE printed = true AND printed_by_user_id = userId AND printed_at::date = CURRENT_DATE` (using Supabase `.select('id', { count: 'exact', head: true })` with filters)
  - If count matches 250 or 500 and not already celebrated, trigger overlay
- Called at the end of successful print paths: `handlePrint` (after line ~662) and `handlePrintGroupId` (after successful group ID print)

### 3. Animation in `tailwind.config.ts`
- Add `celebration-pop` keyframe: scale 0 → 1.15 → 1 with opacity fade-in
- Add corresponding animation class

