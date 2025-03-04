import DateTime from 'app/components/dateTime';
import Duration from 'app/components/duration';
import {BannerContainer, BannerSummary} from 'app/components/events/styles';
import {IconMute} from 'app/icons';
import {t} from 'app/locale';
import {ResolutionStatusDetails} from 'app/types';

type Props = {
  statusDetails: ResolutionStatusDetails;
};

function MutedBox({statusDetails}: Props) {
  function renderReason() {
    const {ignoreUntil, ignoreCount, ignoreWindow, ignoreUserCount, ignoreUserWindow} =
      statusDetails;

    if (ignoreUntil) {
      return t(
        'This issue has been ignored until %s',
        <strong>
          <DateTime date={ignoreUntil} />
        </strong>
      );
    } else if (ignoreCount && ignoreWindow) {
      return t(
        'This issue has been ignored until it occurs %s time(s) in %s',
        <strong>{ignoreCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={ignoreWindow * 60} />
        </strong>
      );
    } else if (ignoreCount) {
      return t(
        'This issue has been ignored until it occurs %s more time(s)',
        <strong>{ignoreCount.toLocaleString()}</strong>
      );
    } else if (ignoreUserCount && ignoreUserWindow) {
      return t(
        'This issue has been ignored until it affects %s user(s) in %s',
        <strong>{ignoreUserCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={ignoreUserWindow * 60} />
        </strong>
      );
    } else if (ignoreUserCount) {
      return t(
        'This issue has been ignored until it affects %s more user(s)',
        <strong>{ignoreUserCount.toLocaleString()}</strong>
      );
    }

    return t('This issue has been ignored');
  }

  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <IconMute color="red300" size="sm" />
        <span>
          {renderReason()}&nbsp;&mdash;&nbsp;
          {t(
            'You will not be notified of any changes and it will not show up by default in feeds.'
          )}
        </span>
      </BannerSummary>
    </BannerContainer>
  );
}

export default MutedBox;
