jest.mock('./jellyfinApi', () => ({
	getAuthHeader: jest.fn(() => 'MediaBrowser Token="test"'),
	getServerType: jest.fn(() => 'jellyfin'),
	getServerUrl: jest.fn(() => 'http://jellyfin.local/'),
	getUserId: jest.fn(() => 'user-123')
}));
jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));
jest.mock('../utils/serverRoutes', () => ({legacyAuthHeader: jest.fn(() => null)}));

const {getServerType, getServerUrl} = require('./jellyfinApi');
const {platformFetch} = require('./secureFetch');
const {probe} = require('./traktApi');

const response = (status, body = '') => ({
	status,
	ok: status >= 200 && status < 300,
	text: jest.fn().mockResolvedValue(body)
});

beforeEach(() => {
	getServerType.mockReturnValue('jellyfin');
	getServerUrl.mockReturnValue('http://jellyfin.local/');
	platformFetch.mockReset();
});

test('does not probe non-Jellyfin servers', async () => {
	getServerType.mockReturnValue('emby');
	await expect(probe()).resolves.toEqual({available: false, status: 'unsupported'});
	expect(platformFetch).not.toHaveBeenCalled();
});

test('treats a missing Trakt route as an unavailable plugin', async () => {
	platformFetch.mockResolvedValue(response(404));
	await expect(probe()).resolves.toEqual({available: false, status: 'unavailable'});
});

test('reports that administrator permission is required to inspect installed plugins', async () => {
	platformFetch.mockResolvedValue(response(403));
	await expect(probe()).resolves.toEqual({available: true, status: 'permission-required'});
});

test('detects the installed Trakt plugin without polling its blocking authorization endpoint', async () => {
	platformFetch.mockResolvedValue(response(200, '[{"Id":"4fe3201e-d6ae-4f2e-8917-e12bda571281","Version":"1.2.3","Status":"Active"}]'));
	await expect(probe()).resolves.toEqual({available: true, status: 'installed', version: '1.2.3', pluginStatus: 'Active'});
	expect(platformFetch).toHaveBeenCalledWith(
		'http://jellyfin.local/Plugins',
		expect.objectContaining({method: 'GET'}),
		10000
	);
});

test('reports a disabled Trakt plugin without treating it as missing', async () => {
	platformFetch.mockResolvedValue(response(200, '[{"Id":"4fe3201e-d6ae-4f2e-8917-e12bda571281","Status":"Disabled"}]'));
	await expect(probe()).resolves.toEqual({available: true, status: 'disabled', version: null, pluginStatus: 'Disabled'});
});


test('requests personalized movie and show recommendations through the Jellyfin plugin', async () => {
	const {getRecommendations} = require('./traktApi');
	platformFetch.mockResolvedValue(response(200, '[]'));
	await expect(getRecommendations('movies')).resolves.toEqual([]);
	expect(platformFetch).toHaveBeenLastCalledWith(
		'http://jellyfin.local/Trakt/Users/user-123/RecommendedMovies',
		expect.objectContaining({method: 'POST'}),
		10000
	);
	await expect(getRecommendations('shows')).resolves.toEqual([]);
	expect(platformFetch).toHaveBeenLastCalledWith(
		'http://jellyfin.local/Trakt/Users/user-123/RecommendedShows',
		expect.objectContaining({method: 'POST'}),
		10000
	);
});

test('rates a Jellyfin item and validates the rating range', async () => {
	const {rateItem} = require('./traktApi');
	platformFetch.mockResolvedValue(response(200, '{}'));
	await expect(rateItem('item-456', 8)).resolves.toEqual({});
	expect(platformFetch).toHaveBeenLastCalledWith(
		'http://jellyfin.local/Trakt/Users/user-123/Items/item-456/Rate?rating=8',
		expect.objectContaining({method: 'POST'}),
		10000
	);
	await expect(rateItem('item-456', 11)).rejects.toThrow('Trakt rating must be an integer from 0 to 10');
});

test('loads and saves the official Trakt plugin configuration', async () => {
	const {getPluginConfiguration, savePluginConfiguration, TRAKT_PLUGIN_ID} = require('./traktApi');
	platformFetch.mockResolvedValue(response(200, '{"TraktUsers":[]}'));
	await expect(getPluginConfiguration()).resolves.toEqual({TraktUsers: []});
	expect(platformFetch).toHaveBeenLastCalledWith(
		`http://jellyfin.local/Plugins/${TRAKT_PLUGIN_ID}/Configuration`,
		expect.objectContaining({method: 'GET'}),
		10000
	);
	platformFetch.mockResolvedValue(response(204));
	await expect(savePluginConfiguration({TraktUsers: []})).resolves.toBeNull();
	expect(platformFetch).toHaveBeenLastCalledWith(
		`http://jellyfin.local/Plugins/${TRAKT_PLUGIN_ID}/Configuration`,
		expect.objectContaining({method: 'POST'}),
		10000
	);
});

test('starts authorization, polls and deauthorizes the signed-in user', async () => {
	const {authorize, pollAuthorizationStatus, deauthorize} = require('./traktApi');
	platformFetch.mockResolvedValue(response(200, '{"userCode":"ABCD-1234"}'));
	await expect(authorize()).resolves.toEqual({userCode: 'ABCD-1234'});
	platformFetch.mockResolvedValue(response(200, '{"isAuthorized":true}'));
	await expect(pollAuthorizationStatus()).resolves.toEqual({isAuthorized: true});
	expect(platformFetch).toHaveBeenLastCalledWith(
		'http://jellyfin.local/Trakt/Users/user-123/PollAuthorizationStatus',
		expect.objectContaining({method: 'GET'}),
		120000
	);
	platformFetch.mockResolvedValue(response(204));
	await expect(deauthorize()).resolves.toBeNull();
});
