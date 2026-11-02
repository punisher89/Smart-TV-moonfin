// Read-only client for the official Jellyfin Trakt plugin endpoints.
// Playback scrobbling and watch-state synchronization remain owned by the server plugin;
// this client only reports whether the plugin is installed and whether this user is linked.
import {getAuthHeader, getServerType, getServerUrl, getUserId} from './jellyfinApi';
import {legacyAuthHeader} from '../utils/serverRoutes';
import {platformFetch} from './secureFetch';

const TIMEOUT_MS = 10000;

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
