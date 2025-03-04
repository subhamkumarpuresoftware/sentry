import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import UserMisery from 'app/components/userMisery';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';
import {vitalsRouteWithQuery} from 'app/views/performance/transactionSummary/transactionVitals/utils';
import {SidebarSpacer} from 'app/views/performance/transactionSummary/utils';
import VitalInfo from 'app/views/performance/vitalDetail/vitalInfo';

type Props = {
  isLoading: boolean;
  hasWebVitals: boolean;
  error: string | null;
  totals: Record<string, number> | null;
  location: Location;
  organization: Organization;
  transactionName: string;
};

function UserStats({
  isLoading,
  hasWebVitals,
  error,
  totals,
  location,
  organization,
  transactionName,
}: Props) {
  let userMisery = error !== null ? <div>{'\u2014'}</div> : <Placeholder height="34px" />;

  if (!isLoading && error === null && totals) {
    const threshold: number | undefined = totals.project_threshold_config[1];
    const miserableUsers: number | undefined = totals.count_miserable_user;
    const userMiseryScore: number = totals.user_misery;
    const totalUsers = totals.count_unique_user;
    userMisery = (
      <UserMisery
        bars={40}
        barHeight={30}
        userMisery={userMiseryScore}
        miseryLimit={threshold}
        totalUsers={totalUsers}
        miserableUsers={miserableUsers}
      />
    );
  }

  const webVitalsTarget = vitalsRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: location.query,
  });

  return (
    <Fragment>
      {hasWebVitals && (
        <Fragment>
          <VitalsHeading>
            <SectionHeading>
              {t('Web Vitals')}
              <QuestionTooltip
                position="top"
                title={t(
                  'Web Vitals with p75 better than the "poor" threshold, as defined by Google Web Vitals.'
                )}
                size="sm"
              />
            </SectionHeading>
            <Link to={webVitalsTarget}>
              <IconOpen />
            </Link>
          </VitalsHeading>
          <VitalInfo
            location={location}
            vital={[WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS]}
            hideVitalPercentNames
            hideDurationDetail
          />
          <SidebarSpacer />
        </Fragment>
      )}
      <SectionHeading>
        {t('User Misery')}
        <QuestionTooltip
          position="top"
          title={getTermHelp(organization, PERFORMANCE_TERM.USER_MISERY_NEW)}
          size="sm"
        />
      </SectionHeading>
      {userMisery}
      <SidebarSpacer />
    </Fragment>
  );
}

const VitalsHeading = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export default UserStats;
