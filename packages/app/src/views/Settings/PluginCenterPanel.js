import {useState} from 'react';
import $L from '@enact/i18n/$L';

import {getPlugins} from '../../services/pluginRegistry';
import {InfoRow, NavRow, SectionTitle} from './settingsRows';

// The registry contains only adapters shipped with this client. Server-side plugins never
// supply executable code to the TV; they are detected through their existing API clients.
const PluginCenterPanel = ({
	achievements, seerr, romm, moonbaseEnabled,
	onOpenAchievements, onOpenMoonbase, onOpenSeerr, onOpenRomm
}) => {
	const [selectedPluginId, setSelectedPluginId] = useState(null);
	const plugins = getPlugins();
	const selectedPlugin = plugins.find((plugin) => plugin.id === selectedPluginId);

	const getAvailability = (plugin) => {
		if (plugin.id === 'achievement-badges') return Boolean(achievements.available);
		if (plugin.id === 'moonfin-server') return Boolean(seerr.pluginInfo);
		return false;
	};

	const getStatus = (plugin) => {
		const available = getAvailability(plugin);
		if (plugin.id === 'moonfin-server' && !moonbaseEnabled) {
			return $L('Enable Moonfin integration to check');
		}
		if (!available) return $L('Not detected on this server');
		if (plugin.id === 'moonfin-server' && seerr.pluginInfo.version) {
			return `${$L('Available')} · ${seerr.pluginInfo.version}`;
		}
		return $L('Available');
	};

	if (selectedPlugin) {
		const available = getAvailability(selectedPlugin);
		const isAchievements = selectedPlugin.id === 'achievement-badges';
		const isMoonfin = selectedPlugin.id === 'moonfin-server';

		return (
			<div>
				<NavRow
					spotlightId='plugin-detail-back'
					title={$L('Plugin Center')}
					desc={$L('Back to installed integrations')}
					icon='arrow_back'
					onClick={() => setSelectedPluginId(null)}
				/>
				<SectionTitle>{selectedPlugin.name}</SectionTitle>
				<InfoRow
					id='plugin-detail-status'
					label={$L('Status')}
					value={getStatus(selectedPlugin)}
					icon='info_outline'
				/>
				<InfoRow
					id='plugin-detail-description'
					label={$L('Description')}
					value={selectedPlugin.description}
					icon='description'
				/>
				{isAchievements && (
					<>
						<SectionTitle>{$L('Available client features')}</SectionTitle>
						<InfoRow id='plugin-detail-achievements' label={$L('Achievement profiles')} value={$L('View earned badges and progress')} icon='military_tech' />
						<InfoRow id='plugin-detail-quests' label={$L('Ranks and quests')} value={$L('Progression and challenges provided by the server')} icon='flag' />
						<InfoRow id='plugin-detail-cosmetics' label={$L('Shop and cosmetics')} value={$L('Browse and equip available profile items')} icon='palette' />
						<InfoRow id='plugin-detail-social' label={$L('Friends and messages')} value={$L('Social features when enabled by the server')} icon='people' />
						{available && (
							<NavRow
								spotlightId='plugin-detail-open-achievements'
								title={$L('Open Achievement Badges')}
								desc={$L('Go to the existing achievements screen')}
								icon='open_in_new'
								onClick={onOpenAchievements}
							/>
						)}
					</>
				)}
				{isMoonfin && (
					<>
						<SectionTitle>{$L('Server capabilities')}</SectionTitle>
						<InfoRow id='plugin-detail-sync' label={$L('Settings sync')} value={$L('Synchronize supported client settings with the server')} icon='sync' />
						<InfoRow id='plugin-detail-markers' label={$L('Anime Markers')} value={$L('Marker support supplied by the Moonfin server plugin')} icon='bookmark' />
						<InfoRow id='plugin-detail-messages' label={$L('Messages and notifications')} value={$L('Server messages and live notifications')} icon='notifications' />
						<InfoRow id='plugin-detail-themes' label={$L('Themes and appearance')} value={$L('Server-provided theme and appearance features')} icon='palette' />
						<InfoRow id='plugin-detail-seerr' label={$L('Seerr integration')} value={$L('Media requests and related server features')} icon='movie' />
						<NavRow
							spotlightId='plugin-detail-open-moonbase'
							title={$L('Moonfin integration settings')}
							desc={$L('Open existing sync and integration settings')}
							icon='settings'
							onClick={onOpenMoonbase}
						/>
					</>
				)}
			</div>
		);
	}

	return (
		<div>
			<SectionTitle>{$L('Client Plugin Adapters')}</SectionTitle>
			{plugins.map((plugin) => (
				<NavRow
					key={plugin.id}
					spotlightId={`plugin-center-${plugin.id}`}
					title={plugin.name}
					desc={getStatus(plugin)}
					icon={plugin.icon}
					onClick={() => setSelectedPluginId(plugin.id)}
				/>
			))}
			<SectionTitle>{$L('Service Integrations')}</SectionTitle>
			<NavRow
				spotlightId='plugin-center-seerr'
				title={$L('Seerr')}
				desc={seerr.isEnabled ? $L('Available') : $L('Not configured')}
				icon='seerr'
				onClick={onOpenSeerr}
			/>
			{romm.available ? (
				<NavRow
					spotlightId='plugin-center-romm'
					title='RomM'
					desc={$L('Available')}
					icon='sports_esports'
					onClick={onOpenRomm}
				/>
			) : (
				<InfoRow
					id='plugin-center-romm'
					label='RomM'
					value={$L('Not configured')}
					icon='sports_esports'
				/>
			)}
			<SectionTitle>{$L('How integrations work')}</SectionTitle>
			<InfoRow
				id='plugin-center-security'
				label={$L('Built into the app')}
				value={$L('Integrations are included in the client and connect to supported server plugin APIs.')}
				icon='verified_user'
			/>
		</div>
	);
};

export default PluginCenterPanel;
