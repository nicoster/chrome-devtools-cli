#!/bin/bash
# Check GitHub Actions CI status

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed."
    echo ""
    echo "Install it with:"
    echo "  macOS: brew install gh"
    echo "  Linux: See https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: winget install GitHub.cli"
    echo ""
    echo "After installation, authenticate with: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

REPO="nicoster/chrome-devtools-cli"

echo "📊 GitHub Actions Status for $REPO"
echo "=================================="
echo ""

# Get the latest workflow run
echo "Latest workflow runs:"
gh run list --repo $REPO --limit 5

echo ""
echo ""

# Get the latest run details
LATEST_RUN=$(gh run list --repo $REPO --limit 1 --json databaseId,status,conclusion,workflowName,createdAt --jq '.[0]')

if [ "$LATEST_RUN" = "null" ] || [ -z "$LATEST_RUN" ]; then
    echo "No workflow runs found."
    exit 0
fi

RUN_ID=$(echo $LATEST_RUN | jq -r '.databaseId')
STATUS=$(echo $LATEST_RUN | jq -r '.status')
CONCLUSION=$(echo $LATEST_RUN | jq -r '.conclusion')
WORKFLOW=$(echo $LATEST_RUN | jq -r '.workflowName')
CREATED=$(echo $LATEST_RUN | jq -r '.createdAt')

echo "Latest Run Details:"
echo "  Workflow: $WORKFLOW"
echo "  Status: $STATUS"
echo "  Conclusion: ${CONCLUSION:-N/A}"
echo "  Created: $CREATED"
echo ""

# Show job details
if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
        echo "✅ All checks passed!"
    else
        echo "❌ Checks failed. Showing job details:"
        echo ""
        # First show job summary
        gh run view $RUN_ID --repo $REPO --json jobs --jq '.jobs[] | "  \(if .conclusion == "success" then "✅" elif .conclusion == "failure" then "❌" elif .conclusion == "cancelled" then "⚠️" else "⏳" end) \(.name) - \(.status) (\(.conclusion // "N/A"))"' 2>/dev/null || echo "  Unable to fetch job details"
        echo ""
        echo "Failed job logs:"
        # Then show failed logs if any
        if gh run view $RUN_ID --repo $REPO --log-failed 2>/dev/null; then
            : # Command succeeded
        else
            echo "  No failed job logs available or unable to fetch logs."
            echo "  View details at: https://github.com/$REPO/actions/runs/$RUN_ID"
        fi
    fi
else
    echo "⏳ Workflow is still running..."
    echo "Watch it live:"
    gh run watch $RUN_ID --repo $REPO
fi

