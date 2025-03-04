import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {disablePlugin, enablePlugin, fetchPlugins} from 'app/actionCreators/plugins';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {Organization, Plugin, Project} from 'app/types';
import {trackIntegrationAnalytics} from 'app/utils/integrationUtil';
import withPlugins from 'app/utils/withPlugins';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';

import ProjectPlugins from './projectPlugins';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  plugins: {
    plugins: Plugin[];
    error: React.ComponentProps<typeof ProjectPlugins>['error'];
    loading: boolean;
  };
  organization: Organization;
  project: Project;
};

class ProjectPluginsContainer extends React.Component<Props> {
  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const plugins = await fetchPlugins(this.props.params);
    const installCount = plugins.filter(
      plugin => plugin.hasConfiguration && plugin.enabled
    ).length;
    trackIntegrationAnalytics(
      'integrations.index_viewed',
      {
        integrations_installed: installCount,
        view: 'legacy_integrations',
        organization: this.props.organization,
      },
      {startSession: true}
    );
  };

  handleChange = (pluginId: string, shouldEnable: boolean) => {
    const {projectId, orgId} = this.props.params;
    const actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator({projectId, orgId, pluginId});
  };

  render() {
    const {loading, error, plugins} = this.props.plugins || {};
    const {orgId} = this.props.params;

    const title = t('Legacy Integrations');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} orgSlug={orgId} />
        <SettingsPageHeader title={title} />
        <PermissionAlert />

        <ProjectPlugins
          {...this.props}
          onChange={this.handleChange}
          loading={loading}
          error={error}
          plugins={plugins}
        />
      </React.Fragment>
    );
  }
}

export default withPlugins(ProjectPluginsContainer);
