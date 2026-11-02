jest.mock('./achievementsApi', () => ({probe: jest.fn()}));

const {probe} = require('./achievementsApi');
const registry = require('./pluginRegistry');

beforeEach(() => {
	probe.mockReset();
	probe.mockResolvedValue(true);
});

test('registers the built-in Achievement Badges adapter with useful metadata', () => {
	const plugin = registry.getPlugin('achievement-badges');
	expect(plugin).toMatchObject({
		id: 'achievement-badges',
		name: 'Achievement Badges',
		category: 'achievements',
		serverTypes: ['jellyfin']
	});
});

test('registers the Moonfin server adapter and reuses the existing ping result', async () => {
	expect(registry.getPlugin('moonfin-server')).toMatchObject({
		id: 'moonfin-server',
		name: 'Moonfin Server Plugin',
		category: 'server',
		serverTypes: ['jellyfin']
	});
	await expect(registry.probePlugin('moonfin-server', {
		serverType: 'jellyfin',
		pluginInfo: {version: '1.0'}
	})).resolves.toEqual({
		id: 'moonfin-server', status: 'available', available: true
	});
	await expect(registry.probePlugin('moonfin-server', {
		serverType: 'jellyfin',
		pluginInfo: null
	})).resolves.toEqual({
		id: 'moonfin-server', status: 'unavailable', available: false
	});
});

test('rejects malformed and duplicate adapters', () => {
	expect(() => registry.registerPlugin({id: 'Bad ID', name: 'Bad', detect: jest.fn()})).toThrow();
	expect(() => registry.registerPlugin({id: 'achievement-badges', name: 'Duplicate', detect: jest.fn()})).toThrow(/already registered/);
});

test('sorts adapters by order and then by name', () => {
	const removeZ = registry.registerPlugin({id: 'test-z', name: 'Zed', order: 50, detect: jest.fn()});
	const removeA = registry.registerPlugin({id: 'test-a', name: 'Alpha', order: 50, detect: jest.fn()});
	expect(registry.getPlugins().map((plugin) => plugin.id)).toEqual(['achievement-badges', 'moonfin-server', 'test-a', 'test-z']);
	removeA();
	removeZ();
});

test('probes the adapter and returns a normalized available status', async () => {
	await expect(registry.probePlugin('achievement-badges', {serverType: 'jellyfin'})).resolves.toEqual({
		id: 'achievement-badges', status: 'available', available: true
	});
	expect(probe).toHaveBeenCalledTimes(1);
});

test('does not call a Jellyfin adapter on Emby and isolates adapter errors', async () => {
	expect(await registry.probePlugin('achievement-badges', {serverType: 'emby'})).toEqual({
		id: 'achievement-badges', status: 'unsupported', available: false
	});
	probe.mockRejectedValueOnce(new Error('offline'));
	const result = await registry.probePlugin('achievement-badges', {serverType: 'jellyfin'});
	expect(result.status).toBe('error');
	expect(result.available).toBe(false);
});

test('returns a result map for every registered adapter', async () => {
	const results = await registry.probePlugins({serverType: 'jellyfin'});
	expect(results['achievement-badges']).toMatchObject({status: 'available', available: true});
});
