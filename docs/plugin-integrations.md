# Client plugin integrations

Moonfin integrations are client-side adapters for server plugins. A Jellyfin plugin stays installed on the media server; the TV app ships the adapter that calls its documented HTTP API and presents the returned data.

## Design rules

- Do not download or execute JavaScript from a Jellyfin server. Adapters are bundled with the signed Moonfin application.
- Keep each plugin's routes, request/response parsing, caching and writes in its own service module.
- Register adapter metadata and a lightweight availability probe in `services/pluginRegistry.js`.
- Probe only after authentication and after the home screen is ready. A missing plugin is a normal unavailable result, not an app error.
- Keep probes cheap. Do not poll from the registry; an integration's context owns any refresh schedule and must stop it when the app is hidden or the account changes.
- A failed adapter must not prevent other adapters from being discovered.
- Keep server-type compatibility explicit. Never call Jellyfin-only plugin routes on Emby or Plex.
- UI screens should be lazy/conditional where practical, and should not add background containers or server-side services.

## Registering an adapter

Add a service module for the plugin API, then register a descriptor:

```js
import {registerPlugin} from './pluginRegistry';
import * as exampleApi from './exampleApi';

registerPlugin({
  id: 'example-plugin',
  name: 'Example Plugin',
  description: 'What the integration adds to Moonfin',
  icon: 'extension',
  category: 'media',
  serverTypes: ['jellyfin'],
  order: 50,
  detect: () => exampleApi.probe()
});
```

The registry exposes `getPlugins()`, `getPlugin(id)`, `probePlugin(id, context)` and `probePlugins(context)`. Detection results use `available`, `unavailable`, `unsupported`, `error`, or `unknown` status values. Adapters should treat 404 and unsupported routes as unavailable and should not throw for an ordinary missing plugin.

## Current adapters

- **Achievement Badges** — the existing `achievementsApi` remains the source of truth for its API; `AchievementsContext` uses the registry for discovery. Its existing Game Center screens and behavior are preserved.
- **Moonfin Server Plugin** — reuses the authenticated `Moonfin Ping` result already collected by `SeerrContext`. It exposes the existing server integration (including Seerr, Anime Markers, messages, themes and settings sync) without issuing a second discovery request.

The Settings > Integrations > Plugin Center screen lists registered client adapters and summarizes the existing Seerr and RomM entry points. Selecting an adapter opens a detail view with its detection status, description, and supported client-facing capabilities; actions lead to the existing Game Center or Moonbase settings rather than duplicating them. The detail view handles the TV remote Back key as well as its on-screen back row. Plugin Center reuses current contexts and settings screens; it does not start duplicate probes or polling loops. Server integrations that cannot be enabled or disabled safely from the client are shown as status/navigation entries rather than given a misleading switch.

More adapters should be added one at a time, with API fixtures/tests and a real-TV check before being exposed as client plugin entries.
