import $L from '@enact/i18n/$L';

import {getPlugins} from '../../services/pluginRegistry';
import {InfoRow, NavRow, SectionTitle} from './settingsRows';

// The registry contains only adapters shipped with this client. Server-side plugins never
// supply executable code to the TV; they are detected through their existing API clients.
const PluginCenterPanel = ({achievements, onOpenAchievements}) => {
	const plugins = getPlugins();

	return (
		<div>
			<SectionTitle>{$L('Client Integrations')}</SectionTitle>
			{plugins.map((plugin) => {
				const available = plugin.id === 'achievement-badges'
					? achievements.available
					: false;
				const status = available ? $L('Available') : $L('Not detected on this server');

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
