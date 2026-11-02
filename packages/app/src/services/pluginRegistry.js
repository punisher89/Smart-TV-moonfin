// A small registry for client-side adapters to Jellyfin server plugins.
//
// This is deliberately not a remote JavaScript loader: TV clients should only run code
// shipped with the signed app. Each adapter owns its API calls and reports whether its
// server-side plugin is available. The registry keeps discovery and metadata consistent.

import * as achievementsApi from './achievementsApi';

const adapters = new Map();

const normalizeAdapter = (adapter) => {
	if (!adapter || typeof adapter !== 'object') throw new TypeError('A plugin adapter must be an object');
	if (typeof adapter.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(adapter.id)) {
		throw new TypeError('A plugin adapter needs a lowercase kebab-case id');
	}
	if (typeof adapter.name !== 'string' || !adapter.name.trim()) throw new TypeError('A plugin adapter needs a name');
	if (typeof adapter.detect !== 'function') throw new TypeError('A plugin adapter needs a detect function');
	return Object.freeze({
		id: adapter.id,
		name: adapter.name.trim(),
		description: typeof adapter.description === 'string' ? adapter.description : '',
		icon: typeof adapter.icon === 'string' ? adapter.icon : 'extension',
		category: typeof adapter.category === 'string' ? adapter.category : 'other',
		serverTypes: Array.isArray(adapter.serverTypes) ? [...adapter.serverTypes] : ['jellyfin'],
		order: Number.isFinite(adapter.order) ? adapter.order : 100,
		detect: adapter.detect
	});
};

export const registerPlugin = (adapter) => {
	const normalized = normalizeAdapter(adapter);
	if (adapters.has(normalized.id)) throw new Error(`Plugin adapter already registered: ${normalized.id}`);
	adapters.set(normalized.id, normalized);
	return () => adapters.delete(normalized.id);
};

export const getPlugin = (id) => adapters.get(id) || null;

export const getPlugins = () => Array.from(adapters.values())
	.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

// Detection failures are isolated per adapter. One broken or incompatible plugin must not
// prevent the rest of the integrations from being discovered.
export const probePlugin = async (id, context = {}) => {
	const adapter = getPlugin(id);
	if (!adapter) return {id, status: 'unknown', available: false};
	if (context.serverType && !adapter.serverTypes.includes(context.serverType)) {
		return {id, status: 'unsupported', available: false};
	}
	try {
		const available = await adapter.detect(context);
		return {id, status: available ? 'available' : 'unavailable', available: Boolean(available)};
	} catch (error) {
		return {id, status: 'error', available: false, error};
	}
};

export const probePlugins = async (context = {}) => {
	const results = await Promise.all(getPlugins().map((adapter) => probePlugin(adapter.id, context)));
	return Object.fromEntries(results.map((result) => [result.id, result]));
};

// First built-in adapter. Its existing API client remains the sole owner of the plugin routes;
// the registry only standardizes discovery and metadata for the rest of the app.
registerPlugin({
	id: 'achievement-badges',
	name: 'Achievement Badges',
	description: 'Achievements, ranks, quests, cosmetics, shop and social features',
	icon: 'military_tech',
	category: 'achievements',
	serverTypes: ['jellyfin'],
	order: 10,
	detect: () => achievementsApi.probe()
});

registerPlugin({
	id: 'moonfin-server',
	name: 'Moonfin Server Plugin',
	description: 'Server features including Seerr, Anime Markers, messages, themes and settings sync',
	icon: 'hub',
	category: 'server',
	serverTypes: ['jellyfin'],
	order: 20,
	// SeerrContext already performs the authenticated Moonfin Ping at setup. Reuse that
	// result rather than making the Plugin Center issue another request.
	detect: ({pluginInfo} = {}) => Boolean(pluginInfo && typeof pluginInfo === 'object')
});
