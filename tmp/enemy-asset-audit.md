# BCU Enemy Asset Audit

Generated: 2026-05-17T12:27:43.220Z

## Summary

- enemiesAudited: 778
- targetEnemies: 7
- missingStats: 0
- missingSemanticActorEntry: 0
- semanticNotFull: 28
- runtimeTolerated: 7
- runtimeBundleUsable: 757
- bundleRefNotInManifest: 28
- currentResolverNull: 0
- missingUiIcon: 3
- missingImage: 0
- missingImgcut: 0
- missingModel: 0
- missingRequiredAnimation: 3

## Target Enemies

| enemyId | stats | semantic | bundleRef | bundle manifest | runtime usable | UI icon | current resolver | failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 388 | yes | full | yes | yes | yes | actor-bundle-icon-fallback | yes | ok |
| 443 | yes | invalid | yes | no | yes | icon-index | yes | ok |
| 609 | yes | full | yes | yes | yes | icon-index | yes | ok |
| 610 | yes | invalid | yes | no | no | no | yes | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 611 | yes | invalid | yes | no | no | no | yes | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 612 | yes | invalid | yes | no | no | no | yes | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 613 | yes | full | yes | yes | yes | actor-bundle-icon-fallback | yes | ok |

## Problem Enemies (first 80)

| enemyId | semantic | failure |
| --- | --- | --- |
| 478 | partial | move, idle, attack, kb, semantic-status-partial, bundle-not-in-manifest |
| 552 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 554 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 556 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 560 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 561 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 562 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 585 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 586 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 587 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 588 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 589 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 590 | partial | move, idle, attack, kb, semantic-status-partial, bundle-not-in-manifest |
| 591 | partial | move, idle, attack, semantic-status-partial, bundle-not-in-manifest |
| 610 | invalid | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 611 | invalid | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 612 | invalid | semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing |
| 698 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 699 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 700 | invalid | semantic-status-invalid, bundle-not-in-manifest |
| 701 | invalid | semantic-status-invalid, bundle-not-in-manifest |
