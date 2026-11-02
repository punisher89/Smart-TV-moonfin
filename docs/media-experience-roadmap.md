# Smart-TV-moonfin: Media Experience Roadmap

This roadmap extends the existing Plugin Center and Trakt work without replacing or rewriting it. Work is delivered in small, reviewable increments on feature branches. The existing `feature/plugin-integration-framework` branch and its draft PR remain untouched; this roadmap branch is based on that branch and is intended to be reviewed as a stacked change.

## Product goals

- Make the TV client feel like a complete media center, not just a Jellyfin remote UI.
- Prefer client-side features that reuse Jellyfin data already fetched by the app.
- Integrate server plugins through explicit, typed adapters; never download or execute JavaScript from a Jellyfin server.
- Keep webOS 6 / older Chromium compatibility in mind.
- Avoid polling loops, duplicate playback tracking, unnecessary network requests, and new server containers.
- Preserve all existing screens, settings, Game Center, Achievement Badges, Moonbase, Seerr, RomM, and Trakt functionality.

## Delivery sequence

### Phase 0 — Foundation and compatibility
- Keep the Plugin Center registry as the single discovery point for supported server-plugin adapters.
- Document feature ownership (client vs. server plugin), compatibility, permissions, and fallback behavior.
- Every integration must be optional and fail independently; one unavailable plugin must not break the client.

### Phase 1 — Cinema Experience
- Add a client-side Cinema Experience settings section with independent controls.
- Build on existing Jellyfin playback/session and media metadata rather than introducing a second playback pipeline.
- Investigate trailer playback, theme music, intro/recap/outro segment actions, and pre-roll presentation separately.
- Do not auto-play trailers or music by default; provide explicit user controls and sensible defaults.
- Respect TV remote navigation, playback focus, audio state, and webOS 6 browser limitations.

### Phase 2 — Smart Library
- Add media-quality labels only when the relevant stream/media-source metadata is already available (resolution, HDR/Dolby Vision, codec, audio format).
- Add smart collection and recommendation surfaces using existing Jellyfin views and metadata.
- Avoid per-poster API calls. Cache derived labels in memory and invalidate them with the existing item refresh lifecycle.

### Phase 3 — Subtitle Center
- Improve subtitle selection and presentation using Jellyfin playback data.
- Add convenient in-player access to language, track, styling and synchronization controls where supported by the platform.
- Never imply that a TV/browser can render a subtitle format or style that its native player does not support.

### Phase 4 — Personal tracking and activity
- Evaluate Letterboxd and AniList integrations with separate, explicit account authorization.
- Add optional Discord/Telegram notifications only where a safe server-side delivery path exists; do not embed bot tokens in the TV app.
- Keep Trakt's existing server-plugin integration intact and do not reuse its private stored OAuth credentials.

### Phase 5 — Music and library maintenance
- Evaluate lyrics and theme-song integrations.
- Add a library assistant for missing episodes, duplicates and incomplete collections using existing server endpoints, with no frequent background scans.

## Acceptance criteria for every increment

1. Changes are isolated in a feature branch; never commit directly to `main`.
2. Existing features and settings are preserved; no broad refactors without a demonstrated need.
3. TV-first UX: D-pad focus, readable layouts, predictable Back behavior, and no mouse-only controls.
4. WebOS 6 compatibility: avoid unsupported browser APIs and heavyweight dependencies.
5. Performance: no new containers, no unnecessary recurring requests, no duplicate metadata fetches, and bounded in-memory caching.
6. Security: no arbitrary remote code, no client-embedded private secrets, and no exposure of administrator-only settings to non-admin users.
7. Tests cover data parsing, feature gating, error isolation, and settings persistence. Report clearly which tests/builds actually ran.

## Initial implementation priority

Start with **Cinema Experience settings and capability detection**, then add individual playback enhancements only after confirming the app's existing playback event flow and Jellyfin segment support. This avoids duplicating player logic and lets each capability be enabled independently.
