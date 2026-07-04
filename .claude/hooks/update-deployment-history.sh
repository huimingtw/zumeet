#!/bin/bash
# PostToolUse hook: appends a deploy entry to deployment-history.md
# when a successful `gcloud run deploy` is detected.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('command', ''))
" 2>/dev/null)

# Only act on gcloud run deploy commands
echo "$COMMAND" | grep -q "gcloud run deploy" || exit 0

RESPONSE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('tool_response', {})
# tool_response may be a list or a dict
if isinstance(r, list):
    print(' '.join(str(x.get('text','')) for x in r))
elif isinstance(r, dict):
    print(r.get('content', ''))
" 2>/dev/null)

# Only record successful deploys (exit code 0 check via output content)
echo "$RESPONSE" | grep -q "has been deployed" || exit 0

REVISION=$(echo "$RESPONSE" | grep -oE 'zumeet-api-[0-9]+-[a-z0-9]+' | head -1)
IMAGE=$(echo "$COMMAND" | grep -oE -- '--image[= ][^ ]+' | sed 's/--image[= ]//' | head -1)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M HKT')
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HISTORY="$REPO_ROOT/deployment-history.md"

{
  echo ""
  echo "### Deploy: $TIMESTAMP"
  echo "- Revision: \`${REVISION:-unknown}\`"
  [ -n "$IMAGE" ] && echo "- Image: \`$IMAGE\`"
} >> "$HISTORY"
