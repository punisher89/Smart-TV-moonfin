import $L from '@enact/i18n/$L';

import {getPlugins} from '../../services/pluginRegistry';
import {InfoRow, NavRow, SectionTitle} from './settingsRows';

// The registry contains only adapters shipped with this client. Server-side plugins never
// supply executable code to the TV; they are detected through their existing API clients.
const PluginCenterPanel = ({
	achievements, seerr, romm, moonbaseEnabled,
	onOpenAchievements, onOpenMoonbase, onOpenSeerr, onOpenRomm
}) => {
	const plugins = getPlugins();

	return (
		<div>
			<SectionTitle>{$L('Client Plugin Adapters')}</SectionTitle>
			{plugins.map((plugin) => {
				const available = plugin.id === 'achievement-badges'
					? achievements.available
					: plugin.id === 'moonfin-server'
						? Boolean(seerr.pluginInfo)
						: false;
				const status = plugin.id === 'moonfin-server' && !moonbaseEnabled
					? $L('Enable Moonfin integration to check')
					: available
						? (plugin.id === 'moonfin-server' && seerr.pluginInfo.version
							? `${$L('Available')} · ${seerr.pluginInfo.version}`
							: $L('Available'))
						: $L('Not detected on this server');

				if (available && plugin.id === 'achievement-badges') {
					return (
						<NavRow
							key={plugin.id}
							spotlightId={`plugin-center-${plugin.id}`}
							title={plugin.name}
							desc={status}
							icon={plugin.icon}
							onClick={onOpenAchievements}
						/>
					);
				}

				if (plugin.id === 'moonfin-server') {
					return (
						<NavRow
							key={plugin.id}
							spotlightId={`plugin-center-${plugin.id}`}
							title={plugin.name}
							desc={status}
							icon={plugin.icon}
							onClick={onOpenMoonbase}
						/>
					);
				}

				return (
					<InfoRow
						key={plugin.id}
						id={`plugin-center-${plugin.id}`}
						label={plugin.name}
						value={status}
						icon={plugin.icon}
					/>
				);
			})}
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
