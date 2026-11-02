// Client for the official Jellyfin Trakt plugin endpoints.
// It never handles playback events itself: scrobbling and watch-state synchronization remain
// server-owned. Client requests are limited to configuration, device authorization, discovery,
// and explicit user-initiated ratings.
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
	const response = await platformFetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
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

	// PollAuthorizationStatus is not a discovery endpoint: the official plugin blocks that
	// request on its device-authorization task. Use Jellyfin's installed-plugin list instead,
	// so opening Plugin Center can never wait for an OAuth device flow to finish.
	try {
		const plugins = await request('/Plugins');
		const plugin = Array.isArray(plugins)
			? plugins.find((entry) => String(entry.Id || entry.id).toLowerCase() === TRAKT_PLUGIN_ID.toLowerCase())
			: null;
		if (!plugin) return {available: false, status: 'unavailable'};
		const pluginStatus = plugin.Status || plugin.status;
		return {
			available: true,
			status: pluginStatus === 'Disabled' ? 'disabled' : 'installed',
			version: plugin.Version || plugin.version || null,
			pluginStatus: pluginStatus || 'Active'
		};
	} catch (error) {
		if (error.status === 403) return {available: false, status: 'permission-required'};
		return {available: false, status: 'error', error};
	}
};
