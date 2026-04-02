for ((i=1; i<=$1; i++)); do
    tmpfile=$(mktemp)
    claude --permission-mode bypassPermissions -p "@PRD.json @progress.txt \
    1. Find the highest-priority task and implement it. \
    2. Run your tests and type checks. \
    3. Update the PRD with what was done. \
    4. Append your progress to progress.txt in every loop iteration and use percentage completion. \
    ONLY WORK ON A SINGLE TASK. \
    If the PRD is complete, output <promise>COMPLETE</promise>." | tee "$tmpfile"
    result=$(cat "$tmpfile")
    rm -f "$tmpfile"

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
        echo "PRD complete after $i iterations."
        exit 0
    fi
done