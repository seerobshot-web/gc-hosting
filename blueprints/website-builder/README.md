# Website Builder Blueprint

SOPs for delivering a client site via Hostinger's AI Builder.

## Checklist
- [ ] Confirm client's chosen pillar/tier (SEED/FRUIT/HARVEST/LABORER) covers
      AI Builder access
- [ ] Provision hosting via the standard ResellPortal order flow
      (`apps/api`'s `/provisioning/orders`, `test_mode` in any non-prod run)
- [ ] Apply brand tokens from `packages/ui` wherever the builder allows
      custom CSS/theme overrides
- [ ] Verify WCAG contrast on any custom color overrides against the
      Cloudlight/Ash Stone/Ember Gold pairs flagged in the design system
- [ ] Hand off login + a short client-facing usage guide
