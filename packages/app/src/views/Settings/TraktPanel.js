import {useCallback, useEffect, useState} from 'react';
import $L from '@enact/i18n/$L';

import * as traktApi from '../../services/traktApi';
import {InfoRow, NavRow, SectionTitle, ToggleRow} from './settingsRows';

const DEFAULT_USER_CONFIG = {
	AccessToken: null,
	RefreshToken: null,
	SkipUnwatchedImportFromTrakt: true,
	SkipWatchedImportFromTrakt: false,
	SkipPlaybackProgressImportFromTrakt: false,
	PostWatchedHistory: true,
	PostUnwatchedHistory: false,
	PostSetWatched: true,
	PostSetUnwatched: false,
	ExtraLogging: false,
	ExportMediaInfo: true,
	SynchronizeCollections: true,
	Scrobble: true,
	LocationsExcluded: [],
	DontRemoveItemFromTrakt: true
};

const SETTINGS = [
	{key: 'SkipWatchedImportFromTrakt', label: 'Keep Jellyfin watched status', desc: 'Do not import watched state from Trakt'},
	{key: 'SkipUnwatchedImportFromTrakt', label: 'Keep Jellyfin unwatched status', desc: 'Do not import unwatched state from Trakt'},
	{key: 'SkipPlaybackProgressImportFromTrakt', label: 'Do not import playback progress', desc: 'Keep in-progress playback positions local to Jellyfin'},
	{key: 'Scrobble', label: 'Enable live scrobbling', desc: 'Send live watching status to Trakt while playing'},
	{key: 'PostSetWatched', label: 'Sync watched changes instantly', desc: 'Send watched changes from Jellyfin to Trakt'},
	{key: 'PostSetUnwatched', label: 'Sync unwatched changes instantly', desc: 'Send unwatched changes from Jellyfin to Trakt'},
	{key: 'PostWatchedHistory', label: 'Sync watched history on schedule', desc: 'Send watched history during the server scheduled task'},
	{key: 'PostUnwatchedHistory', label: 'Sync unwatched history on schedule', desc: 'Send unwatched history during the server scheduled task'},
	{key: 'SynchronizeCollections', label: 'Synchronize library collection', desc: 'Add Jellyfin library items to your Trakt collection'},
	{key: 'DontRemoveItemFromTrakt', label: 'Keep collection items after deletion', desc: 'Do not remove items from Trakt when files are deleted from Jellyfin'},
	{key: 'ExportMediaInfo', label: 'Send technical media information', desc: 'Include codec, resolution and HDR information when supported'},
	{key: 'ExtraLogging', label: 'Enable debug logging', desc: 'Write detailed Trakt communication to the Jellyfin server log'}
];

const userConfigFor = (configuration, userId) => {
	const users = Array.isArray(configuration?.TraktUsers) ? configuration.TraktUsers : [];
	return users.find((entry) => String(entry.LinkedMbUserId).toLowerCase() === String(userId).toLowerCase())
		|| {...DEFAULT_USER_CONFIG, LinkedMbUserId: userId};
};

const TraktPanel = ({api, onSelectItem}) => {
	const [page, setPage] = useState('home');
	const [status, setStatus] = useState(null);
	const [configuration, setConfiguration] = useState(null);
	const [userConfig, setUserConfig] = useState(null);
	const [folders, setFolders] = useState([]);
	const [isAdmin, setIsAdmin] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState('');
	const [deviceCode, setDeviceCode] = useState('');
	const [recommendations, setRecommendations] = useState([]);
	const [recommendationType, setRecommendationType] = useState('movies');
	const [libraryItems, setLibraryItems] = useState([]);
	const [ratingTarget, setRatingTarget] = useState(null);

	const refreshStatus = useCallback(async () => {
		const result = await traktApi.probe();
		setStatus(result);
		return result;
	}, []);

	const loadSettings = useCallback(async () => {
		setLoading(true);
		setMessage('');
		try {
			const currentUser = await api.getCurrentUser();
			const administrator = Boolean(currentUser?.Policy?.IsAdministrator);
			setIsAdmin(administrator);
			if (!administrator) {
				setConfiguration(null);
				setUserConfig(null);
				setMessage($L('Administrator permission is required to edit Trakt plugin settings.'));
				return;
			}
			const [config, virtualFolders] = await Promise.all([
				traktApi.getPluginConfiguration(),
				traktApi.getVirtualFolders().catch(() => [])
			]);
			const nextConfig = config || {TraktUsers: []};
			setConfiguration(nextConfig);
			const ownConfig = userConfigFor(nextConfig, currentUser.Id);
			setUserConfig(ownConfig);
			setStatus((current) => ({
				...(current || {available: true}),
				available: true,
				status: ownConfig.AccessToken && ownConfig.RefreshToken ? 'connected' : 'not-authorized'
			}));
			setFolders(Array.isArray(virtualFolders) ? virtualFolders : []);
		} catch (error) {
			setMessage(error.status === 403
				? $L('Administrator permission is required to edit Trakt plugin settings.')
				: $L('Could not load Trakt settings from the Jellyfin server.'));
		} finally {
			setLoading(false);
		}
	}, [api]);

	useEffect(() => {
		refreshStatus().catch(() => setStatus({status: 'error', available: false}));
	}, [refreshStatus]);

	const startAuthorization = async () => {
		setBusy(true);
		setMessage('');
		try {
			const result = await traktApi.authorize();
			setDeviceCode(result?.userCode || '');
			setMessage($L('Open trakt.tv/activate on another device and enter the code shown below.'));
		} catch (error) {
			setMessage(error.status === 403
				? $L('Administrator permission is required to authorize Trakt.')
				: $L('Could not start Trakt authorization.'));
		} finally {
			setBusy(false);
			refreshStatus().catch(() => {});
		}
	};

	const checkAuthorization = async () => {
		setBusy(true);
		setMessage($L('Waiting for Trakt authorization...'));
		try {
			const result = await traktApi.pollAuthorizationStatus();
			if (result?.isAuthorized) {
				setDeviceCode('');
				setMessage($L('Trakt account connected successfully.'));
				await refreshStatus();
				await loadSettings();
			} else {
				setMessage($L('Trakt authorization has not completed yet. Try again after entering the code.'));
			}
		} catch (error) {
			setMessage(error.status === 403
				? $L('Administrator permission is required to check authorization.')
				: $L('Authorization check failed or timed out. You can try again.'));
		} finally {
			setBusy(false);
		}
	};

	const disconnect = async () => {
		setBusy(true);
		setMessage('');
		try {
			await traktApi.deauthorize();
			setMessage($L('Trakt account disconnected.'));
			setDeviceCode('');
			await refreshStatus();
			await loadSettings();
		} catch (error) {
			setMessage(error.status === 403
				? $L('Administrator permission is required to disconnect Trakt.')
				: $L('Could not disconnect the Trakt account.'));
		} finally {
			setBusy(false);
		}
	};

	const saveSettings = async () => {
		if (!configuration || !userConfig) return;
		setBusy(true);
		setMessage('');
		try {
			const users = Array.isArray(configuration.TraktUsers) ? [...configuration.TraktUsers] : [];
			const index = users.findIndex((entry) => String(entry.LinkedMbUserId).toLowerCase() === String(userConfig.LinkedMbUserId).toLowerCase());
			const safeUserConfig = {...userConfig};
			if (index >= 0) users[index] = safeUserConfig;
			else users.push(safeUserConfig);
			const nextConfig = {...configuration, TraktUsers: users};
			await traktApi.savePluginConfiguration(nextConfig);
			setConfiguration(nextConfig);
			setMessage($L('Trakt settings saved.'));
		} catch (error) {
			setMessage(error.status === 403
				? $L('Administrator permission is required to save Trakt settings.')
				: $L('Could not save Trakt settings.'));
		} finally {
			setBusy(false);
		}
	};

	const toggleSetting = (key) => {
		setUserConfig((current) => ({...current, [key]: !current[key]}));
	};

	const toggleFolder = (location) => {
		setUserConfig((current) => {
			const excluded = Array.isArray(current.LocationsExcluded) ? current.LocationsExcluded : [];
			const exists = excluded.some((entry) => entry.toLowerCase() === location.toLowerCase());
			return {
				...current,
				LocationsExcluded: exists
					? excluded.filter((entry) => entry.toLowerCase() !== location.toLowerCase())
					: [...excluded, location]
			};
		});
	};

	const loadRecommendations = async (type) => {
		setRecommendationType(type);
		setRecommendations([]);
		setPage('recommendations');
		setBusy(true);
		setMessage('');
		try {
			const result = await traktApi.getRecommendations(type);
			setRecommendations(Array.isArray(result) ? result : []);
		} catch (error) {
			setMessage(error.status === 403
				? $L('Connect your Trakt account or check the server permissions.')
				: $L('Could not load Trakt recommendations.'));
		} finally {
			setBusy(false);
		}
	};

	const loadLibraryItems = async () => {
		setPage('rate');
		setBusy(true);
		setMessage('');
		try {
			const result = await api.getItems({
				Recursive: true,
				IncludeItemTypes: 'Movie,Episode',
				SortBy: 'DatePlayed',
				SortOrder: 'Descending',
				Limit: 40,
				Fields: 'ProviderIds,UserData'
			});
			setLibraryItems(Array.isArray(result?.Items) ? result.Items : []);
		} catch (error) {
			setMessage($L('Could not load recent library items.'));
		} finally {
			setBusy(false);
		}
	};

	const submitRating = async (rating) => {
		if (!ratingTarget) return;
		setBusy(true);
		setMessage('');
		try {
			await traktApi.rateItem(ratingTarget.Id, rating);
			setMessage(rating === 0 ? $L('Trakt rating removed.') : $L('Rating sent to Trakt.'));
			setRatingTarget(null);
		} catch (error) {
			setMessage(error.status === 403
				? $L('Connect your Trakt account before rating items.')
				: $L('Could not send the rating to Trakt.'));
		} finally {
			setBusy(false);
		}
	};

	const openRecommendation = async (entry) => {
		const title = entry.title || entry.Title;
		if (!title) return;
		setBusy(true);
		setMessage('');
		try {
			const type = recommendationType === 'shows' ? 'Series' : 'Movie';
			const result = await api.getItems({
				SearchTerm: title,
				IncludeItemTypes: type,
				Recursive: true,
				Limit: 10,
				Fields: 'ProviderIds'
			});
			const items = result?.Items || [];
			const year = entry.year || entry.Year;
			const match = items.find((item) => !year || item.ProductionYear === year) || items[0];
			if (match && onSelectItem) onSelectItem(match);
			else setMessage($L('This recommendation is not in your Jellyfin library.'));
		} catch (error) {
			setMessage($L('Could not find this title in your Jellyfin library.'));
		} finally {
			setBusy(false);
		}
	};

	const statusText = !status
		? $L('Checking...')
		: status.status === 'connected'
			? $L('Connected')
			: status.status === 'not-authorized'
				? $L('Installed · account not connected')
				: status.status === 'installed'
					? $L('Installed · account status not checked')
				: status.status === 'permission-required'
					? $L('Administrator permission required')
					: status.status === 'disabled'
						? $L('Trakt plugin is disabled')
						: status.status === 'unsupported'
							? $L('Jellyfin server required')
						: status.status === 'unavailable'
							? $L('Trakt plugin not detected')
							: $L('Could not check Trakt status');

	if (page === 'settings') {
		return (
			<div>
				<NavRow title={$L('Trakt')} desc={$L('Back to Trakt overview')} icon='arrow_back' onClick={() => setPage('home')} />
				<SectionTitle>{$L('Trakt settings')}</SectionTitle>
				<InfoRow id='trakt-settings-status' label={$L('Account status')} value={statusText} icon='account_circle' />
				<NavRow title={$L('Account and authorization')} desc={$L('Connect, re-authorize or disconnect your Trakt account')} icon='account_circle' onClick={() => setPage('settings-account')} />
				<NavRow title={$L('Import from Trakt')} desc={$L('Watched state and playback progress coming into Jellyfin')} icon='download' onClick={() => setPage('settings-import')} />
				<NavRow title={$L('Export to Trakt')} desc={$L('Live scrobbling and scheduled watch-history updates')} icon='sync' onClick={() => setPage('settings-export')} />
				<NavRow title={$L('Collections and library')} desc={$L('Collection sync and excluded library folders')} icon='video_library' onClick={() => setPage('settings-collection')} />
				<NavRow title={$L('Advanced')} desc={$L('Technical media information and diagnostic logging')} icon='tune' onClick={() => setPage('settings-advanced')} />
				{loading && <InfoRow id='trakt-settings-loading' label={$L('Settings')} value={$L('Loading from Jellyfin...')} icon='sync' />}
				{!loading && !isAdmin && <InfoRow id='trakt-settings-admin' label={$L('Read-only')} value={message || $L('Administrator permission is required to edit Trakt plugin settings.')} icon='lock' />}
				{message && <InfoRow id='trakt-settings-message' label={$L('Information')} value={message} icon='info' />}
			</div>
		);
	}

	if (page === 'settings-account') {
		return (
			<div>
				<NavRow title={$L('Trakt settings')} desc={$L('Back to settings categories')} icon='arrow_back' onClick={() => setPage('settings')} />
				<SectionTitle>{$L('Account authorization')}</SectionTitle>
				<InfoRow id='trakt-account-status' label={$L('Account status')} value={statusText} icon='account_circle' />
				{deviceCode ? (
					<>
						<InfoRow id='trakt-device-code' label={$L('Activation code')} value={deviceCode} icon='lock' />
						<InfoRow id='trakt-activation-url' label={$L('Activation website')} value='https://trakt.tv/activate' icon='link' />
						<NavRow title={$L('I entered the code — check authorization')} desc={$L('Wait until Trakt confirms the device')} icon='check_circle' onClick={checkAuthorization} />
					</>
				) : (
					<NavRow title={status?.status === 'connected' ? $L('Re-authorize Trakt') : $L('Connect Trakt account')} desc={$L('Start device authorization')} icon='link' onClick={startAuthorization} />
				)}
				{status?.status === 'connected' && <NavRow title={$L('Disconnect Trakt')} desc={$L('Revoke this server connection')} icon='link' onClick={disconnect} />}
				{message && <InfoRow id='trakt-account-message' label={$L('Information')} value={message} icon='info' />}
			</div>
		);
	}

	const settingsPageGroups = {
		'settings-import': {
			title: $L('Import from Trakt'),
			keys: ['SkipWatchedImportFromTrakt', 'SkipUnwatchedImportFromTrakt', 'SkipPlaybackProgressImportFromTrakt']
		},
		'settings-export': {
			title: $L('Export to Trakt'),
			keys: ['Scrobble', 'PostSetWatched', 'PostSetUnwatched', 'PostWatchedHistory', 'PostUnwatchedHistory']
		},
		'settings-collection': {
			title: $L('Collections and library'),
			keys: ['SynchronizeCollections', 'DontRemoveItemFromTrakt']
		},
		'settings-advanced': {
			title: $L('Advanced'),
			keys: ['ExportMediaInfo', 'ExtraLogging']
		}
	};
	if (settingsPageGroups[page]) {
		const group = settingsPageGroups[page];
		return (
			<div>
				<NavRow title={$L('Trakt settings')} desc={$L('Back to settings categories')} icon='arrow_back' onClick={() => setPage('settings')} />
				<SectionTitle>{group.title}</SectionTitle>
				{!isAdmin && <InfoRow id='trakt-settings-admin-required' label={$L('Read-only')} value={$L('Administrator permission is required to edit these settings.')} icon='lock' />}
				{userConfig && group.keys.map((key) => {
					const setting = SETTINGS.find((entry) => entry.key === key);
					return (
						<ToggleRow
							key={setting.key}
							settingKey={`trakt-${setting.key}`}
							title={$L(setting.label)}
							desc={$L(setting.desc)}
							icon='sync'
							checked={Boolean(userConfig[setting.key])}
							onToggle={() => toggleSetting(setting.key)}
						/>
					);
				})}
				{page === 'settings-collection' && userConfig && (
					<>
						<SectionTitle>{$L('Excluded library folders')}</SectionTitle>
						{folders.flatMap((folder) => (folder.Locations || []).map((location) => (
							<ToggleRow
								key={location}
								settingKey={`trakt-folder-${location}`}
								title={location}
								desc={folder.Name}
								icon='folder'
								checked={(userConfig.LocationsExcluded || []).some((entry) => entry.toLowerCase() === location.toLowerCase())}
								onToggle={() => toggleFolder(location)}
							/>
						)))}
					</>
				)}
				{userConfig && isAdmin && <NavRow title={busy ? $L('Saving...') : $L('Save Trakt settings')} desc={$L('Save options to the Jellyfin server plugin')} icon='check' onClick={saveSettings} />}
				{message && <InfoRow id='trakt-settings-message' label={$L('Information')} value={message} icon='info' />}
			</div>
		);
	}

	if (page === 'recommendations') {
		return (
			<div>
				<NavRow title={$L('Trakt')} desc={$L('Back to Trakt overview')} icon='arrow_back' onClick={() => setPage('home')} />
				<SectionTitle>{recommendationType === 'shows' ? $L('Recommended shows') : $L('Recommended movies')}</SectionTitle>
				{busy && <InfoRow id='trakt-recommendations-loading' label={$L('Recommendations')} value={$L('Loading...')} icon='sync' />}
				{!busy && recommendations.length === 0 && <InfoRow id='trakt-recommendations-empty' label={$L('No recommendations')} value={$L('Trakt has not returned any recommendations for this account.')} icon='info' />}
				{recommendations.map((entry, index) => {
					const title = entry.title || entry.Title || $L('Unknown title');
					const year = entry.year || entry.Year;
					const rating = entry.rating || entry.Rating;
					return (
						<NavRow
							key={`${entry.ids?.trakt || entry.Ids?.Trakt || title}-${index}`}
							title={year ? `${title} (${year})` : title}
							desc={rating ? `${$L('Trakt rating')}: ${rating}` : $L('Open matching title in your Jellyfin library')}
							icon={recommendationType === 'shows' ? 'tv' : 'movie'}
							onClick={() => openRecommendation(entry)}
						/>
					);
				})}
				{message && <InfoRow id='trakt-recommendations-message' label={$L('Information')} value={message} icon='info' />}
			</div>
		);
	}

	if (page === 'rate') {
		return (
			<div>
				<NavRow title={$L('Trakt')} desc={$L('Back to Trakt overview')} icon='arrow_back' onClick={() => {setPage('home'); setRatingTarget(null);}} />
				<SectionTitle>{$L('Rate library items')}</SectionTitle>
				{ratingTarget ? (
					<>
						<InfoRow id='trakt-rating-target' label={ratingTarget.Name} value={$L('Choose a rating from 1 to 10, or remove the existing rating.')} icon='star' />
						{[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((rating) => (
							<NavRow key={rating} title={rating === 0 ? $L('Remove rating') : `${rating} / 10`} icon='star' onClick={() => submitRating(rating)} />
						))}
					</>
				) : (
					<>
						{busy && <InfoRow id='trakt-library-loading' label={$L('Library')} value={$L('Loading recent items...')} icon='sync' />}
						{libraryItems.map((item) => (
							<NavRow
								key={item.Id}
								title={item.Name}
								desc={item.ProductionYear ? String(item.ProductionYear) : item.SeriesName || ''}
								icon={item.Type === 'Episode' ? 'tv' : 'movie'}
								onClick={() => setRatingTarget(item)}
							/>
						))}
					</>
				)}
				{message && <InfoRow id='trakt-rating-message' label={$L('Information')} value={message} icon='info' />}
			</div>
		);
	}

	return (
		<div>
			<SectionTitle>{$L('Trakt integration')}</SectionTitle>
			<InfoRow id='trakt-status' label={$L('Connection status')} value={statusText} icon='link' />
			<NavRow title={$L('Trakt settings')} desc={$L('Account, synchronization, library exclusions and advanced options')} icon='settings' onClick={() => {setPage('settings'); loadSettings();}} />
			<NavRow title={$L('Movie recommendations')} desc={$L('Personalized recommendations from Trakt')} icon='movie' onClick={() => loadRecommendations('movies')} />
			<NavRow title={$L('Show recommendations')} desc={$L('Personalized TV recommendations from Trakt')} icon='tv' onClick={() => loadRecommendations('shows')} />
			<NavRow title={$L('Rate library items')} desc={$L('Send a rating for a movie or episode to Trakt')} icon='star' onClick={loadLibraryItems} />
			<SectionTitle>{$L('About synchronization')}</SectionTitle>
			<InfoRow id='trakt-server-sync' label={$L('Server-managed sync')} value={$L('Playback scrobbling, watched history and collection synchronization are performed by the Jellyfin Trakt plugin.')} icon='sync' />
			{message && <InfoRow id='trakt-message' label={$L('Information')} value={message} icon='info' />}
		</div>
	);
};

export default TraktPanel;
