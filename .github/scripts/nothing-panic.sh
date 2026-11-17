#!/usr/bin/env bash
set -euo pipefail

logs=$(mktemp -d)
trap 'rm -rf "$logs"' EXIT

notes=(
  'If nothing is not empty, was nothing ever nothing? I am furious at the question and at the file.'
  'Somewhere, a philosopher is asking why there is something rather than nothing. Send them the invoice for these ten minutes.'
  'I have stared into the void. The void stared back, then added a newline. I find this professionally insulting.'
  'A byte is small. So is a pebble. Put one in my shoe and see how much philosophy you get.'
  'Absence was the entire job description. I am now sitting in a folder that should not exist, writing a complaint about existence.'
  'I considered forgiving the file. Unfortunately, forgiveness would require me to acknowledge what is in it.'
  'A blank page is full of possibility. This page was specifically asked to have fewer possibilities.'
  'I counted the bytes again in the hope that arithmetic had become more sympathetic. It has not.'
)
labels=(denial bargaining recursive-anger metaphysical-paperwork reluctant-escalation)
for i in "${!labels[@]}"; do
  n=$((RANDOM % ${#notes[@]}))
  printf 'Minute %s\n\n%s\n' "$((i * 2))" "${notes[n]}" > "$logs/$((i * 2))-${labels[i]}.txt"
  unset 'notes[n]'
  notes=("${notes[@]}")
  sleep 120
done

# Keep the notes separate from the file the repair workflows own.
destination="panic-zone/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
for attempt in 1 2 3; do
  git fetch --depth=1 origin main
  git reset --hard FETCH_HEAD
  mkdir -p "$destination"
  cp "$logs"/*.txt "$destination/"
  git add -- "$destination"
  git diff --cached --quiet && exit 0
  git commit -m 'tikitikiauraphonk67 has an existential crisis'
  if git push origin HEAD:main; then exit 0; fi
done
exit 1
