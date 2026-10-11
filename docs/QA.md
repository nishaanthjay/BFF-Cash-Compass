# Manual QA checklist

Run this before each rollout to a chapter, on the deployed site (or a Vercel preview) with the real Supabase project.
Use a real phone and a laptop or Chromebook. Tick every box; note anything that fails with the time and device.

Automated checks to run first: `npm test`, `npm run build`, `npm run contrast`; and, with `VITE_DEMO=1 npx vite --port 5173`
running, `npm run netcheck -- http://localhost:5173` and `node scripts/e2e.mjs http://localhost:5173 screenshots`.
The database checks are in `supabase/tests/smoke.sql` (CI runs them on Postgres 16).

## 0. Before you start
- [ ] Migrations `0001`-`0008` are applied and the matching build is deployed (see README, "Real deployment").
- [ ] You rotated the facilitator passcode (SECURITY.md) and updated the `MC_PASSCODE` GitHub secret.
- [ ] Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production and Preview.
- [ ] Open DevTools > Network on every page below. There should be **no red 4xx/5xx rows and no console errors**.

## 1. Home page
- [ ] Laptop: headline on the left, compass picture on the right, three cards below.
- [ ] Phone: picture, then headline, then buttons, then cards; no sideways scrolling.
- [ ] Text says "workshop organizer" and "About 8 minutes".

## 2. Facilitator: create a session
- [ ] `/facilitator` asks for the passcode. A wrong passcode says "didn't work".
- [ ] After 8 wrong tries in a row it says to wait about 15 minutes, even for the right passcode. (Do this last, and only on a test project: it locks every facilitator out for 15 minutes.)
- [ ] The right passcode unlocks. Refresh the page: still unlocked. Close the tab and reopen: asks again.
- [ ] "New session" shows **Quick check · about 8 minutes** selected, listing one S, one F and one H problem with "N students so far".
- [ ] Quick start creates a session with a 6-character code. Typing your own 3-10 character code also works.
- [ ] Pick "I'll pick": you can choose up to 10; the time line reads about 2.8 minutes per problem. "Everything" is also offered.
- [ ] The join card is dark with a gold code, readable from the back of a classroom. Full screen works and Esc closes it.
- [ ] Copy link copies a `/join?c=CODE` link.

## 3. Students join and answer (phone and laptop)
- [ ] Scan the QR with a phone: lands on the join screen with the code filled in. On the laptop, type the code instead.
- [ ] A wrong code says it can't find it. A code from an ended session says the session has ended.
- [ ] The join page says the same number of minutes as the facilitator screen, and "You will not see right answers during this activity".
- [ ] You get a random student code. Write it down.
- [ ] Each problem shows its picture, progress dots, "Problem N of 3" and a calm line under Lock answer.
- [ ] Tapping Lock answer shows "Locked in!" briefly. Nothing says right or wrong.
- [ ] Every button and field is easy to tap with a thumb; nothing scrolls sideways.
- [ ] Turn on "reduce motion" in the device settings: the Locked in! message just fades.
- [ ] Answer every problem. The finish screen shows "You finished!", the code large, a Copy my code button, the resume reminder and one money tip.
- [ ] On the facilitator screen, Started and Finished count up within about 5 seconds.

## 4. Wifi drops mid-quiz
- [ ] On the phone, answer two steps, then turn wifi off (airplane mode).
- [ ] Keep answering: the app still moves forward and the header chip says offline.
- [ ] Turn wifi back on: answers sync within about 20 seconds. The facilitator's Answers count catches up.
- [ ] Turn wifi off again, finish the last problem, and check the finish screen says "Waiting for wifi"; Finish stays disabled. Turn wifi on: it says "All answers saved".
- [ ] Resume: close the tab mid-quiz, reopen `/join`, choose "I have a code", type the code: you land on the next unanswered step, with earlier answers unchanged.
- [ ] Reload mid-step: you stay on the same step (no going back).

## 5. Closing and auto-close
- [ ] Close session: the facilitator screen says Closed. A student trying to join now sees "This session has ended".
- [ ] A student who was mid-quiz when you closed sees their late answers flagged (finish screen warns), not lost silently.
- [ ] Reopen from Recent sessions: students can join again and keep going with their codes.
- [ ] Auto-close: in the SQL editor run `update sessions set opened_at = now() - interval '7 hours' where status = 'open'` on a **test** session; joining it now fails with "session ended".

## 6. Dashboard and export
- [ ] `/analysis` opens on **Teach first**: the top 3 gaps as cards, then all problems ranked with coloured bars. Each bar has a word (Big gap / Some gap / Small gap).
- [ ] Clicking a top-3 card opens that problem; "All problems" goes back to the Problems tab.
- [ ] Pick the session you just ran in the scope menu: numbers match the students you saw.
- [ ] Projector mode hides student codes and problems with fewer than 5 students.
- [ ] Export CSV downloads a file with one row per answer. Open it: no names, no formulas starting with `=`.
- [ ] Problems tab: each problem has a picture and no "Draft" label anywhere.
- [ ] The "Data" menu's sample data still works and is labelled SAMPLE.

## 7. Accessibility spot checks
- [ ] Keyboard only: tab through the join screen, a quiz step and the dashboard; focus is always visible.
- [ ] 375 px wide (DevTools device mode): no horizontal scrollbar on any page.
- [ ] A screen reader reads "Problem 2 of 3" for the dots and the code on the finish screen letter by letter.
