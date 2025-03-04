import * as React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import {Item} from 'app/components/dropdownAutoComplete/types';
import DropdownButton from 'app/components/dropdownButton';
import TeamBadge from 'app/components/idBadge/teamBadge';
import Link from 'app/components/links/link';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import {IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Team} from 'app/types';
import useTeams from 'app/utils/useTeams';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  organization: Organization;
  /**
   * Should button be disabled
   */
  disabled: boolean;
  /**
   * Teams that are already selected.
   */
  selectedTeams: Team[];
  /**
   * callback when teams are added
   */
  onAddTeam: (team: Team) => void;
  /**
   * Callback when teams are removed
   */
  onRemoveTeam: (teamSlug: string) => void;
  /**
   * Optional menu header.
   */
  menuHeader?: React.ReactElement;
  /**
   * Message to display when the last team is removed
   * if empty no confirm will be displayed.
   */
  confirmLastTeamRemoveMessage?: string;
};

function TeamSelect({
  disabled,
  selectedTeams,
  menuHeader,
  organization,
  onAddTeam,
  onRemoveTeam,
  confirmLastTeamRemoveMessage,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();

  const handleAddTeam = (option: Item) => {
    const team = teams.find(tm => tm.slug === option.value);
    if (team) {
      onAddTeam(team);
    }
  };

  const renderBody = () => {
    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }
    const confirmMessage =
      selectedTeams.length === 1 && confirmLastTeamRemoveMessage
        ? confirmLastTeamRemoveMessage
        : null;

    return selectedTeams.map(team => (
      <TeamRow
        key={team.slug}
        orgId={organization.slug}
        team={team}
        onRemove={slug => onRemoveTeam(slug)}
        disabled={disabled}
        confirmMessage={confirmMessage}
      />
    ));
  };

  // Only show options that aren't selected in the dropdown
  const options = teams
    .filter(team => !selectedTeams.some(selectedTeam => selectedTeam.slug === team.slug))
    .map((team, index) => ({
      index,
      value: team.slug,
      searchKey: team.slug,
      label: <DropdownTeamBadge avatarSize={18} team={team} />,
    }));

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Team')}
        <DropdownAutoComplete
          items={options}
          busyItemsStillVisible={fetching}
          onChange={debounce<(e: React.ChangeEvent<HTMLInputElement>) => void>(
            e => onSearch(e.target.value),
            DEFAULT_DEBOUNCE_DURATION
          )}
          onSelect={handleAddTeam}
          emptyMessage={t('No teams')}
          menuHeader={menuHeader}
          disabled={disabled}
          alignMenu="right"
        >
          {({isOpen}) => (
            <DropdownButton
              aria-label={t('Add Team')}
              isOpen={isOpen}
              size="xsmall"
              disabled={disabled}
            >
              {t('Add Team')}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
      </PanelHeader>

      <PanelBody>{renderBody()}</PanelBody>
    </Panel>
  );
}

type TeamRowProps = {
  orgId: string;
  team: Team;
  onRemove: Props['onRemoveTeam'];
  disabled: boolean;
  confirmMessage: string | null;
};

const TeamRow = ({orgId, team, onRemove, disabled, confirmMessage}: TeamRowProps) => (
  <TeamPanelItem>
    <StyledLink to={`/settings/${orgId}/teams/${team.slug}/`}>
      <TeamBadge team={team} />
    </StyledLink>
    <Confirm
      message={confirmMessage}
      bypass={!confirmMessage}
      onConfirm={() => onRemove(team.slug)}
      disabled={disabled}
    >
      <Button
        size="xsmall"
        icon={<IconSubtract isCircled size="xs" />}
        disabled={disabled}
      >
        {t('Remove')}
      </Button>
    </Confirm>
  </TeamPanelItem>
);

const DropdownTeamBadge = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
`;

const TeamPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
`;

const StyledLink = styled(Link)`
  flex: 1;
  margin-right: ${space(1)};
`;

export default TeamSelect;
