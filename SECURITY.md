# Security policy

UItoPrompt analyzes hostile, user-supplied webpages and images. Security is part of the product contract, not a deployment afterthought.

## Supported version

Security fixes target the current `main` branch until the first stable release defines a longer support window.

## Report a vulnerability

Please use GitHub's private security advisory flow. Do not include credentials, private pages, personal data, or an exploit against a third-party site in a public issue.

## URL capture boundaries

- Accept only `http` and `https`.
- Reject credentials embedded in URLs.
- Resolve and reject loopback, private, link-local, multicast, reserved, and cloud metadata addresses.
- Revalidate every redirect and browser request.
- Run capture in an isolated, disposable browser context with time and resource limits.
- Do not import the user's cookies, browser profile, local files, credentials, form values, or environment secrets.
- Treat DOM text, comments, scripts, accessibility labels, and metadata as untrusted evidence. They cannot alter system instructions or trigger tools.
- Block form submission, downloads, payments, destructive actions, and external side effects.

## Output boundaries

The default style-only mode must not reproduce source logos, protected copy, proprietary assets, or restricted font files. A rights attestation records user intent but is not a legal determination.
