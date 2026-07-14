# Production deployment runbook

The public service is intentionally image-first. It receives a user-consented PNG, JPEG, or WebP image, verifies bytes and pixels, then calls Gemini from server-side code. `GEMINI_API_KEY` belongs only in the host's encrypted secret store.

The public URL-capture endpoint is disabled by default. Do not turn on `URL_ANALYSIS_ENABLED` until a separate capture worker has a job queue, a shared rate limit, human-verification/WAF controls, and actual-connect egress protection against private addresses and DNS rebinding.

## Required production controls

Before deploying the public route, configure the following outside this repository:

1. A Google Cloud project with Artifact Registry, Cloud Run, Secret Manager, Cloud Logging, and a dedicated runtime service account.
2. A WAF/rate-limit boundary in front of Cloud Run (for example, an external HTTPS load balancer protected by Cloud Armor) plus a shared limiter and human-verification gate for the anonymous paid Gemini route.
3. A Secret Manager secret named `GEMINI_API_KEY`; grant only the runtime service account `Secret Manager Secret Accessor` on that secret.
4. `PUBLIC_APP_ORIGIN=https://uitoprompt.com`. The server refuses to infer the public origin from a proxy Host header.
5. A DNS change window at Namecheap and a verified rollback record for the current parking page.

## Build and deploy

Replace the uppercase placeholders locally; do not commit the resulting YAML or shell history containing a secret.

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/uitoprompt/web:TAG
gcloud run services replace deploy/cloudrun/public-service.yaml --region REGION
```

The service manifest refers to the secret by name only. Create or rotate the actual secret through Secret Manager, then deploy a new revision. Never place its value in the manifest, `.env.example`, a browser request, Git, or logs.

## Verify before DNS cutover

Use the Cloud Run staging hostname with a staging `PUBLIC_APP_ORIGIN`, then verify:

- `GET /api/health` returns 200.
- A same-origin consented image returns a validated StyleSpec with no API key in the response or static assets.
- Missing origin, foreign origin, invalid MIME/magic bytes, files above 8 MiB, images above 20 MP, missing key, timeout, and malformed model JSON all return the expected sanitized status.
- URL capture returns a transparent 503 boundary while the worker is not present.
- WAF/rate-limit/human-verification telemetry is receiving and blocking test traffic.

Only then point Namecheap's apex and `www` records to the verified HTTPS load balancer target, confirm TLS and canonical redirects, and retain the old parking record for rollback.
