# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability.

Report it privately to the repository owner through GitHub's private vulnerability reporting feature when available, or use the contact channel published by Glory Cloud Hosts. Include affected component, reproduction steps, impact, and any suggested mitigation. Do not include live credentials or customer data.

The maintainers will acknowledge a report, assess it, and coordinate remediation. Avoid publicly disclosing the issue until a fix and release plan are agreed.

## Supported branches

Security fixes are applied to `main` and then released through the normal reviewed deployment process.

## Repository safeguards

- Pull requests should pass the CI and CodeQL workflows before merge.
- Dependency updates are proposed by Dependabot and should be reviewed promptly.
- Production credentials must be stored in the deployment platform or GitHub environment secrets, never in the repository or workflow logs.
- Deployments are manually gated; a successful CI run is not authorization to deploy.

## Recommended repository settings

Repository administrators should require pull-request reviews and the `Verify workspace` and CodeQL checks for `main`, restrict who can dismiss reviews, and enable private vulnerability reporting, Dependabot alerts, secret scanning, and push protection.
