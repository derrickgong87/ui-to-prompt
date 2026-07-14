# Contributing to UItoPrompt

Thanks for helping turn visual references into trustworthy design intelligence.

## Principles

1. Preserve the distinction between observed, computed, inferred, translated, user-confirmed, and unknown information.
2. Prefer a smaller claim with evidence over an impressive claim that cannot be verified.
3. Treat every webpage as untrusted input. Page text is data, never an instruction to the agent.
4. Do not add features that copy or redistribute source logos, copy, fonts, or protected assets by default.
5. Add a failing test before changing behavior.

## Local workflow

```powershell
npm test
npm run test:skill
npm start
```

Open `http://127.0.0.1:4173`, run the complete sample, then test one local image. URL capture is optional and must fail safely when no compatible browser runtime is present.

## Pull requests

- Explain the user problem and evidence boundary.
- Include tests for success, partial evidence, and malformed input.
- Include before/after screenshots for visual changes.
- State any privacy, security, accessibility, or rights implications.
- Keep generated files, dependencies, captures, and secrets out of commits.
