1) Overwrite the files in this zip into your repo root.
2) Commit and push.
3) If the repo still contains a mistakenly committed folder named mnt/, delete it.
   Command: rm -rf mnt
Why: a previous bad zip added duplicate TSX files under mnt/data/workrepo/lookup9-v3/... and Next.js type-check can pick them up.
The included tsconfig.json also excludes mnt to prevent that.
