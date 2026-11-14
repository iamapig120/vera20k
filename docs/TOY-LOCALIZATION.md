# Toy localization integration (local candidate)

- Based on the current upstream / Space-to-skip / initial total-progress candidate.
- Toy initializes its options profile with Simplified Chinese. An existing explicit saved language choice overrides this default. Ordinary Web and native defaults remain unchanged.
- Migrated 50 applicable reviewed translations from 60c8591, including Team Color Strength, Custom End Game Movie, and No Stolen Tech. Obsolete old keys were not reintroduced; current upstream translations cover the reorganized option pages.
- Preserves upstream language layering: selected-language entries override matching CSF labels; unrelated game CSF labels remain intact; English fills missing entries. Changing language clears and reapplies this layer.
- Does not restore the withdrawn GAME.FNT status-card experiment, change save layout, edit real user saves, or publish a release.
- The engine source changes are included in patches/web-compat.patch. Build and runtime verification are recorded separately; source integration alone is not publication.
