#!/usr/bin/env bash
# Ralph loop for opencode-ntfy.sh
# Usage: ./ralph.sh [--max-iterations N]
#
# Runs the PROMPT.md through opencode in headless mode in a loop.
# Each iteration picks the next task from PLAN.md, implements it, and commits.
#
# Options:
#   --max-iterations N  Maximum number of iterations to run.
#                       If omitted, runs indefinitely until Ctrl+C.
#
# Examples:
#   ./ralph.sh                      # run forever
#   ./ralph.sh --max-iterations 5   # run 5 iterations then stop

set -euo pipefail

max=0

while [ $# -gt 0 ]; do
  case "$1" in
    --max-iterations)
      max="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: ./ralph.sh [--max-iterations N]" >&2
      exit 1
      ;;
  esac
done

i=0

while [ "$max" -eq 0 ] || [ "$i" -lt "$max" ]; do
  i=$((i + 1))
  echo "=== Ralph loop iteration $i${max:+ / $max} ==="
  cat PROMPT.md | opencode -p --agent tdd
done
