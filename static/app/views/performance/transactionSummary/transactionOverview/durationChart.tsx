import {Component, Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {withTheme} from '@emotion/react';
import {Location, Query} from 'history';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {SpanOperationBreakdownFilter} from '../filter';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    theme: Theme;
    api: Client;
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    currentFilter: SpanOperationBreakdownFilter;
    withoutZerofill: boolean;
  };

function generateYAxisValues() {
  return ['p50()', 'p75()', 'p95()', 'p99()', 'p100()'];
}

/**
 * Fetch and render a stacked area chart that shows duration
 * percentiles over the past 7 days
 */
class DurationChart extends Component<Props> {
  handleLegendSelectChanged = legendChange => {
    const {location} = this.props;
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  render() {
    const {
      theme,
      api,
      project,
      environment,
      location,
      organization,
      query,
      statsPeriod,
      router,
      queryExtra,
      currentFilter,
      withoutZerofill,
    } = this.props;

    const start = this.props.start ? getUtcToLocalDateObject(this.props.start) : null;
    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : null;
    const {utc} = getParams(location.query);

    const legend = {
      right: 10,
      top: 5,
      selected: getSeriesSelection(location),
    };

    const datetimeSelection = {
      start,
      end,
      period: statsPeriod,
    };

    const headerTitle =
      currentFilter === SpanOperationBreakdownFilter.None
        ? t('Duration Breakdown')
        : tct('Span Operation Breakdown - [operationName]', {
            operationName: currentFilter,
          });

    return (
      <Fragment>
        <HeaderTitleLegend>
          {headerTitle}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(
              `Duration Breakdown reflects transaction durations by percentile over time.`
            )}
          />
        </HeaderTitleLegend>
        <ChartZoom
          router={router}
          period={statsPeriod}
          start={start}
          end={end}
          utc={utc === 'true'}
        >
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={project}
              environment={environment}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, 'high')}
              showLoading={false}
              query={query}
              includePrevious={false}
              yAxis={generateYAxisValues()}
              partial
              withoutZerofill={withoutZerofill}
              referrer="api.performance.transaction-summary.duration-chart"
            >
              {({results, errored, loading, reloading, timeframe}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray300" size="lg" />
                    </ErrorPanel>
                  );
                }

                const chartOptions = {
                  grid: {
                    left: '10px',
                    right: '10px',
                    top: '40px',
                    bottom: '0px',
                  },
                  seriesOptions: {
                    showSymbol: false,
                  },
                  tooltip: {
                    trigger: 'axis' as const,
                    valueFormatter: tooltipFormatter,
                  },
                  xAxis: timeframe
                    ? {
                        min: timeframe.start,
                        max: timeframe.end,
                      }
                    : undefined,
                  yAxis: {
                    axisLabel: {
                      color: theme.chartLabel,
                      // p50() coerces the axis to be time based
                      formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
                    },
                  },
                };

                const colors =
                  (results && theme.charts.getColorPalette(results.length - 2)) || [];

                // Create a list of series based on the order of the fields,
                // We need to flip it at the end to ensure the series stack right.
                const series = results
                  ? results
                      .map((values, i: number) => {
                        return {
                          ...values,
                          color: colors[i],
                          lineStyle: {
                            opacity: 0,
                          },
                        };
                      })
                      .reverse()
                  : [];

                return (
                  <ReleaseSeries
                    start={start}
                    end={end}
                    queryExtra={queryExtra}
                    period={statsPeriod}
                    utc={utc === 'true'}
                    projects={project}
                    environments={environment}
                  >
                    {({releaseSeries}) => (
                      <TransitionChart loading={loading} reloading={reloading}>
                        <TransparentLoadingMask visible={reloading} />
                        {getDynamicText({
                          value: (
                            <AreaChart
                              {...zoomRenderProps}
                              {...chartOptions}
                              legend={legend}
                              onLegendSelectChanged={this.handleLegendSelectChanged}
                              series={[...series, ...releaseSeries]}
                            />
                          ),
                          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                        })}
                      </TransitionChart>
                    )}
                  </ReleaseSeries>
                );
              }}
            </EventsRequest>
          )}
        </ChartZoom>
      </Fragment>
    );
  }
}

export default withApi(withTheme(withRouter(DurationChart)));
