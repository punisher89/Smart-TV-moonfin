// Read-only client for the official Jellyfin Trakt plugin endpoints.
// Playback scrobbling and watch-state synchronization remain owned by the server plugin;
// this client only reports whether the plugin is installed and whether this user is linked.
import {getAuthHeader, getServerType, getServerUrl, getUserId} from './jellyfinApi';
import {legacyAuthHeader} from '../utils/serverRoutes';
import {platformFetch} from './secureFetch';

const TIMEOUT_MS = 10000;
const ACTION_TIMEOUT_MS = 120000;
export const TRAKT_PLUGIN_ID = '4fe3201e-d6ae-4f2e-8917-e12bda571281';

const request = async (path, method = 'GET', body, timeoutMs = TIMEOUT_MS) => {
	if (getServerType() !== 'jellyfin') throw new Error('Trakt requires a Jellyfin server');
	const serverUrl = getServerUrl();
	const authHeader = getAuthHeader();
	if (!serverUrl || !authHeader) throw new Error('Not connected to a Jellyfin server');
	const response = await platformFetch(`${serverUrl.replace(/\\/+$/, '')}${path}`, {
		method,
		headers: {
			Authorization: authHeader,
			...legacyAuthHeader(getServerType(), authHeader),
			Accept: 'application/json',
			...(body === undefined ? {} : {'Content-Type': 'application/json'})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	}, timeoutMs);
	if (!response.ok) {
		const error = new Error(`Trakt API error: ${response.status}`);
		error.status = response.status;
		throw error;
	}
	if (response.status === 204) return null;
	const text = await response.text();
	return text ? JSON.parse(text) : null;
};

const userRoute = () => {
	const userId = getUserId();
	if (!userId) throw new Error('No signed-in Jellyfin user');
	return `/Trakt/Users/${encodeURIComponent(userId)}`;
};

export const getPluginConfiguration = () => request(`/Plugins/${TRAKT_PLUGIN_ID}/Configuration`);
export const savePluginConfiguration = (configuration) =>
	request(`/Plugins/${TRAKT_PLUGIN_ID}/Configuration`, 'POST', configuration);
export const getVirtualFolders = () => request('/Library/VirtualFolders');
export const authorize = () => request(`${userRoute()}/Authorize`, 'POST', {});
export const pollAuthorizationStatus = () => request(`${userRoute()}/PollAuthorizationStatus`, 'GET', undefined, ACTION_TIMEOUT_MS);
export const deauthorize = () => request(`${userRoute()}/Deauthorize`, 'POST', {});
export const getRecommendations = (mediaType) => {
	const endpoint = mediaType === 'shows' ? 'RecommendedShows' : 'RecommendedMovies';
	return request(`${userRoute()}/${endpoint}`, 'POST', {});
};
export const rateItem = (itemId, rating) => {
	if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
		return Promise.reject(new TypeError('Trakt rating must be an integer from 0 to 10'));
	}
	return request(`${userRoute()}/Items/${encodeURIComponent(itemId)}/Rate?rating=${rating}`, 'POST', {});
};

export const probe = async () => {
	if (getServerType() !== 'jellyfin') {
		return {available: false, status: 'unsupported'};
	}

	const serverUrl = getServerUrl();
	const userId = getUserId();
	const authHeader = getAuthHeader();
	if (!serverUrl || !userId || !authHeader) {
		return {available: false, status: 'unavailable'};
	}

	const url = `${serverUrl.replace(/\/+$/, '')}/Trakt/Users/${encodeURIComponent(userId)}/PollAuthorizationStatus`;
	try {
		const response = await platformFetch(url, {
			method: 'GET',
			headers: {
				Authorization: authHeader,
				...legacyAuthHeader(getServerType(), authHeader),
				Accept: 'application/json'
			}
		}, TIMEOUT_MS);

		if (response.status === 404) return {available: false, status: 'unavailable'};
		// The official plugin protects its status endpoint with Jellyfin's elevation policy.
		// A 403 therefore means the route cannot be inspected with this account, not that
		// the plugin is missing.
		if (response.status === 403) return {available: true, status: 'permission-required'};
		if (!response.ok) return {available: true, status: 'error'};

		const body = await response.text();
		const result = body ? JSON.parse(body) : null;
		if (!result || typeof result.isAuthorized !== 'boolean') {
			return {available: true, status: 'unknown'};
		}
		return {
			available: true,
			status: result.isAuthorized ? 'connected' : 'not-authorized',
			isAuthorized: result.isAuthorized
		};
	} catch (error) {
		return {available: false, status: 'error', error};
	}
};
