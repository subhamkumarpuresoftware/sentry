import {lazy, Suspense, useEffect, useRef} from 'react';
import {useHotkeys} from 'react-hotkeys-hook';
import styled from '@emotion/styled';

import {
  displayDeployPreviewAlert,
  displayExperimentalSpaAlert,
} from 'app/actionCreators/deployPreview';
import {fetchGuides} from 'app/actionCreators/guides';
import {openCommandPalette} from 'app/actionCreators/modal';
import AlertActions from 'app/actions/alertActions';
import {initApiClientErrorHandling} from 'app/api';
import ErrorBoundary from 'app/components/errorBoundary';
import GlobalModal from 'app/components/globalModal';
import HookOrDefault from 'app/components/hookOrDefault';
import Indicators from 'app/components/indicators';
import {DEPLOY_PREVIEW_CONFIG, EXPERIMENTAL_SPA} from 'app/constants';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import OrganizationStore from 'app/stores/organizationStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {Config} from 'app/types';
import useApi from 'app/utils/useApi';
import withConfig from 'app/utils/withConfig';

import SystemAlerts from './systemAlerts';

const GlobalNotifications = HookOrDefault({
  hookName: 'component:global-notifications',
  defaultComponent: () => null,
});

type Props = {
  config: Config;
  children: React.ReactNode;
};

const InstallWizard = lazy(() => import('app/views/admin/installWizard'));
const NewsletterConsent = lazy(() => import('app/views/newsletterConsent'));

/**
 * App is the root level container for all uathenticated routes.
 */
function App({config, children}: Props) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);

  // Command palette global-shortcut
  useHotkeys('command+shift+p, command+k, ctrl+shift+p, ctrl+k', e => {
    openCommandPalette();
    e.preventDefault();
  });

  // Theme toggle global shortcut
  useHotkeys(
    'command+shift+l, ctrl+shift+l',
    e => {
      ConfigStore.set('theme', config.theme === 'light' ? 'dark' : 'light');
      e.preventDefault();
    },
    [config.theme]
  );

  /**
   * Loads the users organization list into the OrganizationsStore
   */
  async function loadOrganizations() {
    try {
      const data = await api.requestPromise('/organizations/', {query: {member: '1'}});
      OrganizationsStore.load(data);
    } catch {
      // TODO: do something?
    }
  }

  /**
   * Creates Alerts for any internal health problems
   */
  async function checkInternalHealth() {
    let data: any = null;

    try {
      data = await api.requestPromise('/internal/health/');
    } catch {
      // TODO: do something?
    }

    data?.problems?.forEach?.(problem => {
      const {id, message, url} = problem;
      const type = problem.severity === 'critical' ? 'error' : 'warning';

      AlertActions.addAlert({id, message, type, url});
    });
  }

  useEffect(() => {
    loadOrganizations();
    checkInternalHealth();

    // Show system-level alerts
    config.messages.forEach(msg =>
      AlertActions.addAlert({message: msg.message, type: msg.level, neverExpire: true})
    );

    // The app is running in deploy preview mode
    if (DEPLOY_PREVIEW_CONFIG) {
      displayDeployPreviewAlert();
    }

    // The app is running in local SPA mode
    if (!DEPLOY_PREVIEW_CONFIG && EXPERIMENTAL_SPA) {
      displayExperimentalSpaAlert();
    }

    // Set the user for analytics
    if (config.user) {
      HookStore.get('analytics:init-user').map(cb => cb(config.user));
    }

    initApiClientErrorHandling();
    fetchGuides();

    // When the app is unloaded clear the organizationst list
    return () => OrganizationsStore.load([]);
  }, []);

  function clearUpgrade() {
    ConfigStore.set('needsUpgrade', false);
  }

  function clearNewsletterConsent() {
    const flags = {...config.user.flags, newsletter_consent_prompt: false};
    ConfigStore.set('user', {...config.user, flags});
  }

  const needsUpgrade = config.user?.isSuperuser && config.needsUpgrade;
  const newsletterConsentPrompt = config.user?.flags?.newsletter_consent_prompt;

  function renderBody() {
    if (needsUpgrade) {
      return (
        <Suspense fallback={null}>
          <InstallWizard onConfigured={clearUpgrade} />;
        </Suspense>
      );
    }

    if (newsletterConsentPrompt) {
      return (
        <Suspense fallback={null}>
          <NewsletterConsent onSubmitSuccess={clearNewsletterConsent} />
        </Suspense>
      );
    }

    return children;
  }

  // Used to restore focus to the container after closing the modal
  const mainContainerRef = useRef<HTMLDivElement>(null);

  return (
    <MainContainer tabIndex={-1} ref={mainContainerRef}>
      <GlobalModal onClose={() => mainContainerRef.current?.focus?.()} />
      <SystemAlerts className="messages-container" />
      <GlobalNotifications
        className="notifications-container messages-container"
        organization={organization ?? undefined}
      />
      <Indicators className="indicators-container" />
      <ErrorBoundary>{renderBody()}</ErrorBoundary>
    </MainContainer>
  );
}

export default withConfig(App);

const MainContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  outline: none;
  padding-top: ${p => (ConfigStore.get('demoMode') ? p.theme.demo.headerSize : 0)};
`;
