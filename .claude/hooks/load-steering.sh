#!/bin/bash
# コンパクト後にステアリングドキュメントを読み込むhook

STEERING_FILE="$CLAUDE_PROJECT_DIR/docs/steering/tech.md"

if [ -f "$STEERING_FILE" ]; then
  CONTENT=$(cat "$STEERING_FILE")
  # JSONとして出力（jqでエスケープ）
  cat << EOF
{
  "continue": true,
  "additionalContext": $(echo "$CONTENT" | jq -Rs .)
}
EOF
else
  echo '{"continue": true}'
fi
