# PR Preview Deployment Setup

This repository is configured to automatically deploy pull request previews to temporary URLs for testing.

## How It Works

When you create or update a pull request:
1. GitHub Actions automatically builds your changes
2. Deploys them to a unique temporary URL using Surge.sh
3. Posts a comment on the PR with the preview link
4. Updates the preview whenever you push new commits

Each PR gets a unique URL in the format: `https://mysql-calc-pr-{PR_NUMBER}.surge.sh`

## Initial Setup (Repository Owner Only)

To enable PR previews, you need to configure Surge.sh credentials:

### 1. Create a Surge.sh Account

If you don't have a Surge account:

```bash
npm install -g surge
surge login
```

Or create an account at: https://surge.sh

### 2. Get Your Surge Token

```bash
surge token
```

This will display your Surge token. Copy it.

### 3. Add Secrets to GitHub

Go to your repository settings:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

   - **Name:** `SURGE_LOGIN`
     - **Value:** Your Surge email address

   - **Name:** `SURGE_TOKEN`
     - **Value:** Your Surge token (from step 2)

### 4. Done!

Once the secrets are configured, PR previews will automatically deploy for all new and updated pull requests.

## Testing a Preview

1. Create a pull request
2. Wait for the GitHub Action to complete (usually ~30 seconds)
3. Check the PR comments for the preview URL
4. Click the link to view your changes

## Troubleshooting

**Build fails with authentication error:**
- Verify that both `SURGE_LOGIN` and `SURGE_TOKEN` secrets are correctly set
- Make sure the token hasn't expired - regenerate if needed with `surge token`

**Preview URL not accessible:**
- Check the Actions tab for build errors
- Ensure the deployment step completed successfully

**Comment not appearing:**
- The workflow needs `pull-requests: write` permission (already configured)
- Check the Actions tab for any script errors

## Manual Deployment (Local Testing)

You can also deploy to Surge manually:

```bash
# Install Surge globally
npm install -g surge

# Login to Surge
surge login

# Deploy current directory
surge . your-custom-domain.surge.sh
```

## Cleanup

Preview deployments remain active until manually removed. To remove old previews:

```bash
surge teardown mysql-calc-pr-{PR_NUMBER}.surge.sh
```

Or manage deployments at: https://surge.sh/account
