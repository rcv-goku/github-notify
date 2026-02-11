# Azure Trusted Signing Setup

This document describes the setup for code signing GitHub releases using Azure Trusted Signing with OIDC authentication.

## GitHub Repository Secrets

Add the following secrets to your GitHub repository settings:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | `e1494d49-3158-4ab2-bb3b-c50553606274` |
| `AZURE_TENANT_ID` | `15d19784-ad58-4a57-a66f-ad1c0f826a45` |
| `AZURE_SUBSCRIPTION_ID` | `acc5f226-a338-4a6c-b311-f0101cef4fa6` |

To add these secrets:
1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** for each secret

## Azure Resources

### Managed Identity
- **Name**: `test-github-oidc`
- **Client ID**: `e1494d49-3158-4ab2-bb3b-c50553606274`
- **Principal ID**: `09a8a21c-4502-4b4f-ab2e-c615534b465f`
- **Resource Group**: `rcv-certs`

### Federated Credential
- **Name**: `github-releases`
- **Issuer**: `https://token.actions.githubusercontent.com`
- **Subject**: `repo:rcv-goku/github-notify:ref:refs/tags/*`
- **Audiences**: `api://AzureADTokenExchange`

### Trusted Signing
- **Account**: `wellskydeveloper`
- **Endpoint**: `https://eus.codesigning.azure.net/`
- **Certificate Profile**: `CodeSign`

## How It Works

1. When you push a tag starting with `v` (e.g., `v1.0.0`), the workflow triggers
2. The build job compiles your application and uploads unsigned binaries
3. The sign job:
   - Downloads the unsigned binaries
   - Authenticates to Azure using OIDC (no secrets stored!)
   - Signs the binaries using Azure Trusted Signing
   - Verifies the signatures
   - Uploads the signed binaries
4. The release job creates a GitHub release with the signed binaries

## Testing

To test the workflow:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Verification

After downloading a signed binary from a release, verify the signature:

```powershell
Get-AuthenticodeSignature .\YourApp.exe | Select-Object Status, SignerCertificate
```

Expected output: `Status=Valid`, with Subject containing your organization name.
