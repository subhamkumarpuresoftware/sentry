import {useEffect, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import TeamActions from 'app/actions/teamActions';
import {Client} from 'app/api';
import OrganizationStore from 'app/stores/organizationStore';
import TeamStore from 'app/stores/teamStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {TeamWithProjects} from 'app/types';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import RequestError from 'app/utils/requestError/requestError';
import useApi from 'app/utils/useApi';

type State = {
  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
  /**
   * Indicates that Team results (from API) are paginated and there are more
   * Teams that are not in the initial response.
   */
  hasMore: null | boolean;
  /**
   * The last query we searched. Used to validate the cursor
   */
  lastSearch: null | string;
  /**
   * Pagination
   */
  nextCursor?: null | string;
};

export type Result = {
  /**
   * The loaded teams list
   */
  teams: TeamWithProjects[];
  /**
   * This is an action provided to consumers for them to update the current
   * teams result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
} & Pick<State, 'fetching' | 'hasMore' | 'fetchError'>;

type Options = {
  /**
   * Number of teams to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * Slugs of teams to immediately fetch
   */
  slugs?: string[];
  /**
   * Whether to immediately attempt to provide user teams
   */
  provideUserTeams?: boolean;
};

type FetchTeamOptions = Pick<Options, 'limit'> & {
  slugs?: string[];
  cursor?: State['nextCursor'];
  search?: State['lastSearch'];
  lastSearch?: State['lastSearch'];
  userTeams?: boolean;
};

/**
 * Helper function to actually load teams
 */
async function fetchTeams(
  api: Client,
  orgId: string,
  {slugs, search, limit, lastSearch, cursor, userTeams}: FetchTeamOptions = {}
) {
  if (userTeams) {
    const teams = await api.requestPromise(`/organizations/${orgId}/user-teams/`);
    return {results: teams, hasMore: false, nextCursor: null};
  }

  const query: {
    query?: string;
    cursor?: typeof cursor;
    per_page?: number;
  } = {};

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ?? ''} ${search}`.trim();
  }

  const isSameSearch = lastSearch === search || (!lastSearch && !search);

  if (isSameSearch && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/teams/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore = paginationObject?.next?.results || paginationObject?.previous?.results;
    nextCursor = paginationObject?.next?.cursor;
  }

  return {results: data, hasMore, nextCursor};
}

function useTeams({limit, slugs, provideUserTeams}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(TeamStore);

  const [state, setState] = useState<State>({
    fetching: false,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null,
  });

  async function loadSpecificTeams() {
    // TODO(davidenwang): Currently used to tell if we have all teams in the store already or if we need to fetch more, should be replaced with something more reliable
    if (store.teams.length < 100) {
      return;
    }

    const orgId = organization?.slug;

    if (orgId === undefined) {
      return;
    }

    let teamPromise: ReturnType<typeof fetchTeams> | null = null;

    if (slugs) {
      teamPromise = fetchTeams(api, orgId, {
        slugs,
        limit,
      });
    } else if (provideUserTeams) {
      teamPromise = fetchTeams(api, orgId, {userTeams: true});
    }

    if (!teamPromise) {
      return;
    }

    try {
      setState({...state, fetching: true});
      const {results, hasMore, nextCursor} = await teamPromise;
      const fetchedTeams = uniqBy([...store.teams, ...results], ({slug}) => slug);
      TeamActions.loadTeams(fetchedTeams);

      setState({
        ...state,
        hasMore,
        fetching: false,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, fetchError: err});
    }
  }

  async function handleSearch(search: string) {
    const {lastSearch} = state;
    const cursor = state.nextCursor;

    if (search === '') {
      return;
    }

    const orgId = organization?.slug;
    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useTeam.onSearch without an orgId passed to useTeam');
      return;
    }

    setState({...state, fetching: true});

    try {
      api.clear();
      const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor,
      });

      const fetchedTeams = uniqBy([...store.teams, ...results], ({slug}) => slug);

      // Only update the store if we have more items
      if (fetchedTeams.length > store.teams.length) {
        TeamActions.loadTeams(fetchedTeams);
      }

      setState({
        ...state,
        hasMore,
        fetching: false,
        lastSearch: search,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, fetchError: err});
    }
  }

  useEffect(() => {
    if (slugs || provideUserTeams) {
      loadSpecificTeams();
    }
  }, [slugs, provideUserTeams]);

  let filteredTeams = store.teams;

  if (provideUserTeams) {
    filteredTeams = filteredTeams.filter(t => t.isMember);
  } else if (slugs) {
    filteredTeams = filteredTeams.filter(t => slugs.includes(t.slug));
  }

  const result: Result = {
    teams: filteredTeams as TeamWithProjects[],
    fetching: state.fetching || store.loading,
    fetchError: state.fetchError,
    hasMore: state.hasMore,
    onSearch: handleSearch,
  };

  return result;
}

export default useTeams;
