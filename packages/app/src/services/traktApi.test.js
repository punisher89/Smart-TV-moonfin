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

test('reports that the plugin exists when the status route requires administrator permission', async () => {
	platformFetch.mockResolvedValue(response(403));
	await expect(probe()).resolves.toEqual({available: true, status: 'permission-required'});
});

test('reports an authorized Trakt account', async () => {
	platformFetch.mockResolvedValue(response(200, '{"isAuthorized":true}'));
	await expect(probe()).resolves.toEqual({available: true, status: 'connected', isAuthorized: true});
	expect(platformFetch).toHaveBeenCalledWith(
		'http://jellyfin.local/Trakt/Users/user-123/PollAuthorizationStatus',
		expect.objectContaining({method: 'GET'}),
		10000
	);
});

test('distinguishes an installed plugin with no linked Trakt account', async () => {
	platformFetch.mockResolvedValue(response(200, '{"isAuthorized":false}'));
	await expect(probe()).resolves.toEqual({available: true, status: 'not-authorized', isAuthorized: false});
});
