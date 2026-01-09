#!/bin/bash
# ralph-once.sh - Human-in-the-loop Ralph
# Run this manually, watch what Claude does, then run again
# Good for building intuition before going fully AFK

claude --permission-mode acceptEdits "@plans/prd.json @progress.txt \

=== GETTING STARTED ===
1. Run \`pwd\` to see your working directory.
2. Read the git logs and progress.txt to understand recent work.
3. Run \`./scripts/init.sh\` to start the development server.
4. Run a basic smoke test to verify the app works.

=== YOUR TASK ===
5. Read plans/prd.json and find the highest-priority feature where passes:false.
   Choose based on YOUR judgment of priority - not just the first one in the list.
   Consider dependencies between features.

6. Implement ONLY that single feature.

7. TEST THOROUGHLY before marking complete:
   - Run \`pnpm typecheck\` - must pass
   - Run \`pnpm test\` - must pass  
   - Use browser automation (Puppeteer/Playwright) to test end-to-end
   - Test as a human user would - click through the actual UI
   - Take screenshots to verify visual correctness
   - Check browser console for errors

8. ONLY after ALL tests pass:
   - Update prd.json: set passes:true and completed_at timestamp
   - Update progress.txt with what you did and any notes for the next session

9. Make a git commit with a descriptive message.

=== CRITICAL RULES ===
- ONLY WORK ON A SINGLE FEATURE
- NEVER mark passes:true without full E2E browser testing
- NEVER remove or edit feature descriptions in prd.json
- ALWAYS leave the codebase in a clean, working state
- If the app is broken when you start, fix it FIRST before new features

If all features have passes:true, output <promise>COMPLETE</promise>
"