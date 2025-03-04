import * as React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {updateSavedQueryVisit} from 'app/actionCreators/discoverSavedQueries';
import {fetchTotalCount} from 'app/actionCreators/events';
import {fetchProjectsCount} from 'app/actionCreators/projects';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Confirm from 'app/components/confirm';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {IconFlag} from 'app/icons';
import {t, tct} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SavedQuery} from 'app/types';
import {defined, generateQueryWithTag} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {DisplayModes} from 'app/utils/discover/types';
import localStorage from 'app/utils/localStorage';
import {decodeList, decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {addRoutePerformanceContext} from '../performance/utils';

import {DEFAULT_EVENT_VIEW} from './data';
import ResultsChart from './resultsChart';
import ResultsHeader from './resultsHeader';
import Table from './table';
import Tags from './tags';
import {generateTitle} from './utils';

type Props = {
  api: Client;
  router: InjectedRouter;
  location: Location;
  organization: Organization;
  selection: GlobalSelection;
  savedQuery?: SavedQuery;
  loading: boolean;
};

type State = {
  eventView: EventView;
  error: string;
  errorCode: number;
  totalValues: null | number;
  showTags: boolean;
  needConfirmation: boolean;
  confirmedQuery: boolean;
  incompatibleAlertNotice: React.ReactNode;
  savedQuery?: SavedQuery;
};
const SHOW_TAGS_STORAGE_KEY = 'discover2:show-tags';

function readShowTagsState() {
  const value = localStorage.getItem(SHOW_TAGS_STORAGE_KEY);
  return value === '1';
}

function getYAxis(location: Location, eventView: EventView, savedQuery?: SavedQuery) {
  return location.query.yAxis
    ? decodeList(location.query.yAxis)
    : savedQuery?.yAxis && savedQuery.yAxis.length > 0
    ? decodeList(savedQuery?.yAxis)
    : [eventView.getYAxis()];
}

class Results extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    if (nextProps.savedQuery || !nextProps.loading) {
      const eventView = EventView.fromSavedQueryOrLocation(
        nextProps.savedQuery,
        nextProps.location
      );
      return {...prevState, eventView, savedQuery: nextProps.savedQuery};
    }
    return prevState;
  }

  state: State = {
    eventView: EventView.fromSavedQueryOrLocation(
      this.props.savedQuery,
      this.props.location
    ),
    error: '',
    errorCode: 200,
    totalValues: null,
    showTags: readShowTagsState(),
    needConfirmation: false,
    confirmedQuery: false,
    incompatibleAlertNotice: null,
  };

  componentDidMount() {
    const {organization, selection, location} = this.props;
    loadOrganizationTags(this.tagsApi, organization.slug, selection);
    addRoutePerformanceContext(selection);
    this.checkEventView();
    this.canLoadEvents();
    if (defined(location.query.id)) {
      updateSavedQueryVisit(organization.slug, location.query.id);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {api, location, organization, selection} = this.props;
    const {eventView, confirmedQuery, savedQuery} = this.state;

    this.checkEventView();
    const currentQuery = eventView.getEventsAPIPayload(location);
    const prevQuery = prevState.eventView.getEventsAPIPayload(prevProps.location);
    const yAxisArray = getYAxis(location, eventView, savedQuery);
    const prevYAxisArray = getYAxis(
      prevProps.location,
      prevState.eventView,
      prevState.savedQuery
    );

    if (
      !isAPIPayloadSimilar(currentQuery, prevQuery) ||
      this.hasChartParametersChanged(
        prevState.eventView,
        eventView,
        prevYAxisArray,
        yAxisArray
      )
    ) {
      api.clear();
      this.canLoadEvents();
    }
    if (
      !isEqual(prevProps.selection.datetime, selection.datetime) ||
      !isEqual(prevProps.selection.projects, selection.projects)
    ) {
      loadOrganizationTags(this.tagsApi, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }

    if (prevState.confirmedQuery !== confirmedQuery) this.fetchTotalCount();
  }

  tagsApi: Client = new Client();

  hasChartParametersChanged(
    prevEventView: EventView,
    eventView: EventView,
    prevYAxisArray: string[],
    yAxisArray: string[]
  ) {
    if (!isEqual(prevYAxisArray, yAxisArray)) {
      return true;
    }

    const prevDisplay = prevEventView.getDisplayMode();
    const display = eventView.getDisplayMode();

    return prevDisplay !== display;
  }

  canLoadEvents = async () => {
    const {api, location, organization} = this.props;
    const {eventView} = this.state;
    let needConfirmation = false;
    let confirmedQuery = true;
    const currentQuery = eventView.getEventsAPIPayload(location);
    const duration = eventView.getDays();

    if (duration > 30 && currentQuery.project) {
      let projectLength = currentQuery.project.length;

      if (
        projectLength === 0 ||
        (projectLength === 1 && currentQuery.project[0] === '-1')
      ) {
        try {
          const results = await fetchProjectsCount(api, organization.slug);

          if (projectLength === 0) projectLength = results.myProjects;
          else projectLength = results.allProjects;
        } catch (err) {
          // do nothing, so the length is 0 or 1 and the query is assumed safe
        }
      }

      if (projectLength > 10) {
        needConfirmation = true;
        confirmedQuery = false;
      }
    }
    // Once confirmed, a change of project or datetime will happen before this can set it to false,
    // this means a query will still happen even if the new conditions need confirmation
    // using a state callback to return this to false
    this.setState({needConfirmation, confirmedQuery}, () => {
      this.setState({confirmedQuery: false});
    });
    if (needConfirmation) {
      this.openConfirm();
    }
  };

  openConfirm = () => {};

  setOpenFunction = ({open}) => {
    this.openConfirm = open;
    return null;
  };

  handleConfirmed = async () => {
    this.setState({needConfirmation: false, confirmedQuery: true}, () => {
      this.setState({confirmedQuery: false});
    });
  };

  handleCancelled = () => {
    this.setState({needConfirmation: false, confirmedQuery: false});
  };

  async fetchTotalCount() {
    const {api, organization, location} = this.props;
    const {eventView, confirmedQuery} = this.state;

    if (confirmedQuery === false || !eventView.isValid()) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );
      this.setState({totalValues: totals});
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  checkEventView() {
    const {eventView} = this.state;
    const {loading} = this.props;
    if (eventView.isValid() || loading) {
      return;
    }

    // If the view is not valid, redirect to a known valid state.
    const {location, organization, selection} = this.props;
    const nextEventView = EventView.fromNewQueryWithLocation(
      DEFAULT_EVENT_VIEW,
      location
    );
    if (nextEventView.project.length === 0 && selection.projects) {
      nextEventView.project = selection.projects;
    }
    if (location.query?.query) {
      nextEventView.query = decodeScalar(location.query.query, '');
    }

    browserHistory.replace(nextEventView.getResultsViewUrlTarget(organization.slug));
  }

  handleChangeShowTags = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.results.toggle_tag_facets',
      eventName: 'Discoverv2: Toggle Tag Facets',
      organization_id: parseInt(organization.id, 10),
    });
    this.setState(state => {
      const newValue = !state.showTags;
      localStorage.setItem(SHOW_TAGS_STORAGE_KEY, newValue ? '1' : '0');
      return {...state, showTags: newValue};
    });
  };

  handleSearch = (query: string) => {
    const {router, location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    router.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  handleYAxisChange = (value: string[]) => {
    const {router, location} = this.props;
    const isDisplayMultiYAxisSupported = [
      DisplayModes.DEFAULT,
      DisplayModes.DAILY,
    ].includes(location.query.display as DisplayModes);

    const newQuery = {
      ...location.query,
      yAxis: value,
      // If using Multi Y-axis and not in a supported display, change to the default display mode
      display:
        value.length > 1 && !isDisplayMultiYAxisSupported
          ? location.query.display === DisplayModes.DAILYTOP5
            ? DisplayModes.DAILY
            : DisplayModes.DEFAULT
          : location.query.display,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat axis changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }

    trackAnalyticsEvent({
      eventKey: 'discover_v2.y_axis_change',
      eventName: "Discoverv2: Change chart's y axis",
      organization_id: parseInt(this.props.organization.id, 10),
      y_axis_value: value,
    });
  };

  handleDisplayChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      display: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat display changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  getDocumentTitle(): string {
    const {organization} = this.props;
    const {eventView} = this.state;
    if (!eventView) {
      return '';
    }
    return generateTitle({eventView, organization});
  }

  renderTagsTable() {
    const {organization, location} = this.props;
    const {eventView, totalValues, confirmedQuery} = this.state;

    return (
      <Layout.Side>
        <Tags
          generateUrl={this.generateTagUrl}
          totalValues={totalValues}
          eventView={eventView}
          organization={organization}
          location={location}
          confirmedQuery={confirmedQuery}
        />
      </Layout.Side>
    );
  }

  generateTagUrl = (key: string, value: string) => {
    const {organization} = this.props;
    const {eventView} = this.state;

    const url = eventView.getResultsViewUrlTarget(organization.slug);
    url.query = generateQueryWithTag(url.query, {
      key,
      value,
    });
    return url;
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, errors) => {
    const {organization} = this.props;
    const {eventView} = this.state;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.create_alert_clicked',
      eventName: 'Discoverv2: Create alert clicked',
      status: 'error',
      query: eventView.query,
      errors,
      organization_id: organization.id,
      url: window.location.href,
    });

    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );

    this.setState({incompatibleAlertNotice});
  };

  renderError(error: string) {
    if (!error) {
      return null;
    }
    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  setError = (error: string, errorCode: number) => {
    this.setState({error, errorCode});
  };

  render() {
    const {organization, location, router} = this.props;
    const {
      eventView,
      error,
      errorCode,
      totalValues,
      showTags,
      incompatibleAlertNotice,
      confirmedQuery,
      savedQuery,
    } = this.state;
    const fields = eventView.hasAggregateField()
      ? generateAggregateFields(organization, eventView.fields)
      : eventView.fields;
    const query = eventView.query;
    const title = this.getDocumentTitle();
    const yAxisArray = getYAxis(location, eventView, savedQuery);

    return (
      <SentryDocumentTitle title={title} orgSlug={organization.slug}>
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <ResultsHeader
              errorCode={errorCode}
              organization={organization}
              location={location}
              eventView={eventView}
              onIncompatibleAlertQuery={this.handleIncompatibleQuery}
              yAxis={yAxisArray}
            />
            <Layout.Body>
              {incompatibleAlertNotice && <Top fullWidth>{incompatibleAlertNotice}</Top>}
              <Top fullWidth>
                {this.renderError(error)}
                <StyledSearchBar
                  searchSource="eventsv2"
                  organization={organization}
                  projectIds={eventView.project}
                  query={query}
                  fields={fields}
                  onSearch={this.handleSearch}
                  maxQueryLength={MAX_QUERY_LENGTH}
                />
                <ResultsChart
                  router={router}
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  onAxisChange={this.handleYAxisChange}
                  onDisplayChange={this.handleDisplayChange}
                  total={totalValues}
                  confirmedQuery={confirmedQuery}
                  yAxis={yAxisArray}
                />
              </Top>
              <Layout.Main fullWidth={!showTags}>
                <Table
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  title={title}
                  setError={this.setError}
                  onChangeShowTags={this.handleChangeShowTags}
                  showTags={showTags}
                  confirmedQuery={confirmedQuery}
                />
              </Layout.Main>
              {showTags ? this.renderTagsTable() : null}
              <Confirm
                priority="primary"
                header={<strong>{t('May lead to thumb twiddling')}</strong>}
                confirmText={t('Do it')}
                cancelText={t('Nevermind')}
                onConfirm={this.handleConfirmed}
                onCancel={this.handleCancelled}
                message={
                  <p>
                    {tct(
                      `You've created a query that will search for events made
                      [dayLimit:over more than 30 days] for [projectLimit:more than 10 projects].
                      A lot has happened during that time, so this might take awhile.
                      Are you sure you want to do this?`,
                      {
                        dayLimit: <strong />,
                        projectLimit: <strong />,
                      }
                    )}
                  </p>
                }
              >
                {this.setOpenFunction}
              </Confirm>
            </Layout.Body>
          </LightWeightNoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const Top = styled(Layout.Main)`
  flex-grow: 0;
`;

type SavedQueryState = AsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
};

class SavedQueryAPI extends AsyncComponent<Props, SavedQueryState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    if (location.query.id) {
      return [
        [
          'savedQuery',
          `/organizations/${organization.slug}/discover/saved/${location.query.id}/`,
        ],
      ];
    }
    return [];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody(): React.ReactNode {
    const {savedQuery, loading} = this.state;
    return (
      <Results {...this.props} savedQuery={savedQuery ?? undefined} loading={loading} />
    );
  }
}

function ResultsContainer(props: Props) {
  /**
   * Block `<Results>` from mounting until GSH is ready since there are API
   * requests being performed on mount.
   *
   * Also, we skip loading last used projects if you have multiple projects feature as
   * you no longer need to enforce a project if it is empty. We assume an empty project is
   * the desired behavior because saved queries can contain a project filter.
   */

  return (
    <GlobalSelectionHeader
      skipLoadLastUsed={props.organization.features.includes('global-views')}
    >
      <SavedQueryAPI {...props} />
    </GlobalSelectionHeader>
  );
}

export default withApi(withOrganization(withGlobalSelection(ResultsContainer)));
