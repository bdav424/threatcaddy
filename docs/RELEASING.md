# ThreatCaddy — macOS Release Guide

## Overview

macOS builds are code-signed with a Developer ID Application certificate and
notarized via the App Store Connect API. The `release-mac.yml` GitHub Actions
workflow handles this automatically on every `v*` tag push.

---

## Required GitHub Secrets

| Secret | What it is |
|---|---|
| `APPLE_CERT_BASE64` | `base64 -i DeveloperID.p12` — the full p12 cert |
| `APPLE_CERT_PASSWORD` | Password you set when exporting the p12 from Keychain |
| `APPLE_API_KEY` | **File path is injected by CI** — store the raw `.p8` content as the secret value; CI writes it to a temp file |
| `APPLE_API_KEY_ID` | 10-character key ID from App Store Connect |
| `APPLE_API_ISSUER` | UUID issuer ID from App Store Connect → Users and Access → Keys |
| `CSC_NAME` | Certificate common name, e.g. `Developer ID Application: Your Name (TEAMID)` |

> **Note:** `APPLE_API_KEY` is the path to the `.p8` file on the runner, not the file
> content. electron-builder 26+ reads it directly from the environment. The CI workflow
> passes the path of the secrets-injected file; adjust if your CI writes it to a known path.

---

## Creating a Release

```sh
git tag v1.2.3
git push origin v1.2.3
```

The workflow triggers, builds the app, signs + notarizes, then attaches `*.dmg`,
`*.zip`, and `latest-mac.yml` to the GitHub Release automatically.

---

## Certificate Renewal

Developer ID Application certs expire after **5 years**.

1. Set a calendar reminder 60 days before expiry.
2. Generate a new certificate in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list).
3. Export it from Keychain as a `.p12` with a strong password.
4. Encode it: `base64 -i DeveloperID.p12 | pbcopy`
5. Update the `APPLE_CERT_BASE64` and `APPLE_CERT_PASSWORD` secrets in the repo's
   Settings → Secrets and variables → Actions.

---

## App Store Connect API Key Rotation

Keys do not auto-expire but should be rotated annually or when team members leave.

1. Go to [App Store Connect → Users and Access → Integrations → Team Keys](https://appstoreconnect.apple.com/access/integrations/api).
2. Revoke the old key.
3. Generate a new key (role: Developer or Admin for notarization).
4. Download the `.p8` file — **you can only download it once**.
5. Update three secrets: `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, and `APPLE_API_KEY`.

---

## Manual Notarization Fallback

If CI notarization fails (network issues, quota, API key problem), notarize manually:

```sh
# 1. Submit the DMG for notarization and wait for Apple's response
xcrun notarytool submit dist-desktop/ThreatCaddy.dmg \
  --key /path/to/AuthKey_KEYID.p8 \
  --key-id KEYID \
  --issuer YOUR-ISSUER-UUID \
  --wait

# 2. Staple the notarization ticket to the DMG so it works offline
xcrun stapler staple dist-desktop/ThreatCaddy.dmg

# 3. Validate stapling succeeded
xcrun stapler validate dist-desktop/ThreatCaddy.dmg
```

Replace `KEYID` and `YOUR-ISSUER-UUID` with the values from App Store Connect.

To check the status of a previously submitted request without `--wait`:

```sh
xcrun notarytool history \
  --key /path/to/AuthKey_KEYID.p8 \
  --key-id KEYID \
  --issuer YOUR-ISSUER-UUID
```

---

## Troubleshooting

**"The application does not have a valid signature"** — verify `CSC_NAME` exactly
matches the certificate's Common Name in Keychain Access.

**Notarization returns `Invalid` status** — fetch the full log:
```sh
xcrun notarytool log SUBMISSION_ID \
  --key /path/to/AuthKey_KEYID.p8 \
  --key-id KEYID \
  --issuer YOUR-ISSUER-UUID
```
Common causes: unsigned nested binary (check `extraResources`), missing
`com.apple.security.cs.allow-jit` entitlement, or hardened runtime disabled.

**safeStorage decrypt error after re-signing** — expected. The OS Keychain key
rotates when the signing identity changes. Existing credentials are automatically
cleared; users will be prompted to reconnect mail, calendar, and Slack accounts.
This is the intended behavior — no data loss beyond the need to re-authenticate.
