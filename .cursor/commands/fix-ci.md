# Fix CI and Push

Check GitHub Actions CI status, fix errors, commit changes, and push to GitHub.

## Overview

This command automates the CI/CD workflow by:
1. Checking GitHub Actions status using `check-ci.sh`
2. Analyzing failed jobs and errors
3. Fixing identified issues
4. Committing changes
5. Pushing to GitHub

## Usage

### Basic Usage
```
fix-ci
```

This will:
- Run `scripts/check-ci.sh` to check the latest CI run status
- If there are failures, analyze the error logs
- Fix the issues automatically
- Commit the fixes with an appropriate message
- Push to the current branch

### Options

- **Auto-fix mode** (default): Automatically fixes common CI errors
- **Interactive mode**: Prompts before making changes
- **Dry-run mode**: Shows what would be fixed without making changes

## Workflow Steps

### 1. Check CI Status
```bash
./scripts/check-ci.sh
```

Shows:
- Latest workflow runs
- Job status and conclusions
- Failed job logs (if any)

### 2. Analyze Errors
The command analyzes:
- Build errors (TypeScript compilation, linting)
- Test failures
- Dependency issues
- Configuration problems

### 3. Fix Issues
Common fixes include:
- **TypeScript errors**: Fix type mismatches, missing imports
- **Linting errors**: Auto-fix with ESLint/Prettier
- **Test failures**: Update tests or fix implementation
- **Dependency issues**: Update package.json, install missing deps
- **Build errors**: Fix configuration issues

### 4. Commit Changes
```bash
git add .
git commit -m "fix: resolve CI errors

- Fixed [specific error type]
- Updated [affected files]
- Resolved [issue description]"
```

### 5. Push to GitHub
```bash
git push origin [current-branch]
```

## Common CI Error Patterns

### TypeScript Compilation Errors
- Missing type definitions
- Type mismatches
- Import path issues

### Linting Errors
- Code style violations
- Unused variables
- Missing semicolons

### Test Failures
- Assertion errors
- Timeout issues
- Mock configuration problems

### Build Configuration
- Missing build scripts
- Incorrect TypeScript config
- Missing dependencies

## Examples

### Fix and Push
```
fix-ci
```

This will automatically:
1. Check CI status
2. Identify errors
3. Apply fixes
4. Commit with message: "fix: resolve CI errors"
5. Push to current branch

### Check Only (No Fix)
```
fix-ci --check-only
```

Shows CI status without making any changes.

### Interactive Mode
```
fix-ci --interactive
```

Prompts before each fix and commit.

## Integration with GitHub Actions

Works with GitHub Actions workflows that:
- Run on push/PR
- Check code quality (linting, type checking)
- Run tests
- Build the project

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Git repository initialized
- Current branch has remote tracking set up

## Troubleshooting

### GitHub CLI Not Installed
```bash
# macOS
brew install gh

# Then authenticate
gh auth login
```

### No CI Runs Found
- Ensure GitHub Actions is enabled for the repository
- Check that workflows exist in `.github/workflows/`

### Authentication Issues
```bash
gh auth status
gh auth login
```

### Git Push Fails
- Check branch permissions
- Ensure you have push access
- Verify remote is configured: `git remote -v`

