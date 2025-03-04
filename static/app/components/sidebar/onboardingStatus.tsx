import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import OnboardingSidebar from 'app/components/onboardingWizard/sidebar';
import {getMergedTasks} from 'app/components/onboardingWizard/taskConfig';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'app/components/progressRing';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {OnboardingTaskStatus, Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme, {Theme} from 'app/utils/theme';
import withProjects from 'app/utils/withProjects';

import {CommonSidebarProps, SidebarPanelKey} from './types';

type Props = CommonSidebarProps & {
  org: Organization;
  projects: Project[];
};

const isDone = (task: OnboardingTaskStatus) =>
  task.status === 'complete' || task.status === 'skipped';

const progressTextCss = () => css`
  font-size: ${theme.fontSizeMedium};
  font-weight: bold;
`;

function OnboardingStatus({
  collapsed,
  org,
  projects,
  currentPanel,
  orientation,
  hidePanel,
  onShowPanel,
}: Props) {
  const handleShowPanel = () => {
    trackAnalyticsEvent({
      eventKey: 'onboarding.wizard_opened',
      eventName: 'Onboarding Wizard Opened',
      organization_id: org.id,
    });
    onShowPanel();
  };

  if (!org.features?.includes('onboarding')) {
    return null;
  }

  const tasks = getMergedTasks({organization: org, projects});

  const allDisplayedTasks = tasks.filter(task => task.display);
  const doneTasks = allDisplayedTasks.filter(isDone);
  const numberRemaining = allDisplayedTasks.length - doneTasks.length;

  const pendingCompletionSeen = doneTasks.some(
    task =>
      allDisplayedTasks.some(displayedTask => displayedTask.task === task.task) &&
      task.status === 'complete' &&
      !task.completionSeen
  );

  const isActive = currentPanel === SidebarPanelKey.OnboardingWizard;

  if (doneTasks.length >= allDisplayedTasks.length && !isActive) {
    return null;
  }

  return (
    <Fragment>
      <Container onClick={handleShowPanel} isActive={isActive}>
        <ProgressRing
          animateText
          textCss={progressTextCss}
          text={allDisplayedTasks.length - doneTasks.length}
          value={(doneTasks.length / allDisplayedTasks.length) * 100}
          backgroundColor="rgba(255, 255, 255, 0.15)"
          progressEndcaps="round"
          size={38}
          barWidth={6}
        />
        {!collapsed && (
          <div>
            <Heading>{t('Quick Start')}</Heading>
            <Remaining>
              {tct('[numberRemaining] Remaining tasks', {numberRemaining})}
              {pendingCompletionSeen && <PendingSeenIndicator />}
            </Remaining>
          </div>
        )}
      </Container>
      {isActive && (
        <OnboardingSidebar
          orientation={orientation}
          collapsed={collapsed}
          onClose={hidePanel}
        />
      )}
    </Fragment>
  );
}

const Heading = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray200};
  margin-bottom: ${space(0.25)};
`;

const Remaining = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(0.75)};
  align-items: center;
`;

const PendingSeenIndicator = styled('div')`
  background: ${p => p.theme.red300};
  border-radius: 50%;
  height: 7px;
  width: 7px;
`;

const hoverCss = (p: {theme: Theme}) => css`
  background: rgba(255, 255, 255, 0.05);

  ${RingBackground} {
    stroke: rgba(255, 255, 255, 0.3);
  }
  ${RingBar} {
    stroke: ${p.theme.green200};
  }
  ${RingText} {
    color: ${p.theme.white};
  }

  ${Heading} {
    color: ${p.theme.white};
  }
  ${Remaining} {
    color: ${p.theme.gray200};
  }
`;

const Container = styled('div')<{isActive: boolean}>`
  padding: 9px 19px 9px 16px;
  cursor: pointer;
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1.5)};
  align-items: center;
  transition: background 100ms;

  ${p => p.isActive && hoverCss(p)};

  &:hover {
    ${hoverCss};
  }
`;

export default withProjects(OnboardingStatus);
