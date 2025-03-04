import {
  IconCalixa,
  IconClickup,
  IconGeneric,
  IconKomodor,
  IconLinear,
  IconRookout,
  IconShortcut,
  IconSpikesh,
  IconTeamwork,
  IconZepel,
} from 'app/icons';
import {SentryAppComponent} from 'app/types';

type Props = {
  slug: SentryAppComponent['sentryApp']['slug'];
};

const SentryAppIcon = ({slug}: Props) => {
  switch (slug) {
    case 'calixa':
      return <IconCalixa size="md" />;
    case 'clickup':
      return <IconClickup size="md" />;
    case 'komodor':
      return <IconKomodor size="md" />;
    case 'linear':
      return <IconLinear size="md" />;
    case 'rookout':
      return <IconRookout size="md" />;
    case 'shortcut':
      return <IconShortcut size="md" />;
    case 'spikesh':
      return <IconSpikesh size="md" />;
    case 'teamwork':
      return <IconTeamwork size="md" />;
    case 'zepel':
      return <IconZepel size="md" />;
    default:
      return <IconGeneric size="md" />;
  }
};

export {SentryAppIcon};
