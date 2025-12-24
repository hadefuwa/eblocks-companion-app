# Git Commands for Pushing and Creating a Release Tag

## Step 1: Stage all changes
```bash
git add .
```

Or if you want to exclude certain files (like `graphical.md` or `drivers/` if they shouldn't be committed):
```bash
git add package.json package-lock.json src/ drivers/
```

## Step 2: Commit your changes
```bash
git commit -m "feat: Bundle Arduino CLI and E-Blocks drivers with installer

- Fixed Arduino CLI path resolution (removed double-quoting issue)
- Added E-Blocks USB driver installation support
- Bundled drivers with app via extraResources
- Added driver installation UI button
- Enhanced debug logging for Arduino CLI detection
- Fixed circular dependency in package.json"
```

## Step 3: Push to GitHub
```bash
git push origin main
```

## Step 4: Create a version tag
```bash
git tag -a v2.4.0 -m "Release v2.4.0: Arduino CLI and driver support"
```

## Step 5: Push the tag to GitHub
```bash
git push origin v2.4.0
```

## Alternative: Create and push tag in one command
```bash
git push origin main --tags
```

## All-in-one script
```bash
# Stage, commit, push, and tag
git add .
git commit -m "feat: Bundle Arduino CLI and E-Blocks drivers with installer"
git push origin main
git tag -a v2.4.0 -m "Release v2.4.0: Arduino CLI and driver support"
git push origin v2.4.0
```

## View existing tags
```bash
git tag -l
```

## Delete a tag (if needed)
```bash
# Delete locally
git tag -d v2.4.0

# Delete on remote
git push origin --delete v2.4.0
```

## Create a GitHub Release from the tag
After pushing the tag, you can:
1. Go to https://github.com/hadefuwa/eblocks-companion-app/releases
2. Click "Draft a new release"
3. Select the tag `v2.4.0`
4. Add release notes
5. Attach the installer file: `dist-electron/E-Blocks 3 Companion Setup 2.4.0.exe`



