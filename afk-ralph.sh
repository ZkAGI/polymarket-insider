#!/bin/bash
# afk-ralph.sh - Fully autonomous Ralph loop
# Usage: ./afk-ralph.sh <iterations>
# Example: ./afk-ralph.sh 20

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo "Example: $0 20"
  exit 1
fi

MAX_ITERATIONS=$1
START_TIME=$(date +%s)

echo "=============================================="
echo "Starting AFK Ralph - $MAX_ITERATIONS iterations max"
echo "Started at: $(date)"
echo "=============================================="

for ((i=1; i<=$MAX_ITERATIONS; i++)); do
  echo ""
  echo "----------------------------------------------"
  echo "ITERATION $i of $MAX_ITERATIONS"
  echo "Time: $(date)"
  echo "----------------------------------------------"
  
  result=$(claude --permission-mode acceptEdits -p "@plans/prd.json @progress.txt \

=== GETTING STARTED ===
1. Run \`pwd\` to see your working directory.
2. Read the git logs (\`git log --oneline -10\`) and progress.txt to understand recent work.
3. Run \`./scripts/init.sh\` to start the development server if not running.
4. Run a basic smoke test - navigate to the app and verify it loads.
   If the app is broken, FIX IT FIRST before doing anything else.

=== CHOOSE YOUR TASK ===
5. Read plans/prd.json carefully.
6. Find the highest-priority feature where passes:false.
   This should be the one YOU decide has highest priority - not necessarily first in list.
   Consider: dependencies, complexity, what makes sense to build next.

=== IMPLEMENT ===
7. Implement ONLY that single feature.
   Write clean, well-documented code.

=== TEST THOROUGHLY ===
8. Before marking ANY feature complete, you MUST:

   a) TYPE CHECKING:
      \`pnpm typecheck\` (or npm/yarn equivalent)
      Must pass with no errors.

   b) UNIT TESTS:
      \`pnpm test\` (or npm/yarn equivalent)  
      Must pass. Write new tests if needed.

   c) END-TO-END BROWSER TESTING (CRITICAL):
      Use Puppeteer or Playwright to test as a human would:
      - Navigate to the actual page
      - Click buttons, fill forms, interact with UI
      - Verify the feature works end-to-end
      - Take screenshots for verification
      - Check browser console for errors
      
      Do NOT rely only on unit tests or curl commands.
      Do NOT mark a feature done without browser testing.

   d) VISUAL VERIFICATION:
      Take screenshots and verify the UI looks correct.
      Check for layout issues, missing elements, broken styling.

=== UPDATE STATUS ===
9. ONLY after ALL tests pass:
   - In prd.json: set \`passes: true\` and \`completed_at\` timestamp
   - In prd.json: add any notes about the implementation
   - It is UNACCEPTABLE to remove or edit feature descriptions

10. Update progress.txt with:
    - What feature you completed
    - What approach you took
    - Any issues you encountered
    - Notes for the next agent session
    - Use this to leave a note for the next person working in the codebase

=== COMMIT ===
11. Make a git commit with a clear, descriptive message:
    \`git add -A && git commit -m \"feat(F00X): description of what was done\"\`

=== CRITICAL RULES ===
- ONLY WORK ON A SINGLE FEATURE per iteration
- NEVER mark passes:true without browser automation E2E testing
- NEVER remove or modify feature descriptions in prd.json
- ALWAYS leave code in a clean, mergeable state
- If you find bugs in existing features, fix them FIRST
- Browser automation testing is MANDATORY for UI features

=== COMPLETION ===
If you check prd.json and ALL features have passes:true, output:
<promise>COMPLETE</promise>
")

  echo "$result"

  # Check for completion sigil
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo ""
    echo "=============================================="
    echo "PRD COMPLETE!"
    echo "Finished after $i iterations"
    echo "Total time: $((DURATION / 60)) minutes $((DURATION % 60)) seconds"
    echo "=============================================="
    
    # Optional: send notification (uncomment and customize)
    # notify-send "Ralph Complete" "PRD finished after $i iterations"
    # osascript -e 'display notification "PRD finished" with title "Ralph Complete"'
    
    exit 0
  fi

  # Brief pause between iterations
  sleep 2
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=============================================="
echo "Reached max iterations ($MAX_ITERATIONS)"
echo "PRD may not be complete - check progress.txt"
echo "Total time: $((DURATION / 60)) minutes $((DURATION % 60)) seconds"
echo "=============================================="

exit 1
