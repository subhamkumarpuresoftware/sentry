import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import Tag, {Background} from 'app/components/tag';
import {t} from 'app/locale';
import {BreadcrumbLevelType} from 'app/types/breadcrumbs';

type Props = {
  level: BreadcrumbLevelType;
  searchTerm?: string;
};

const Level = memo(function Level({level, searchTerm = ''}: Props) {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
      return (
        <LevelTag type="error">
          <Highlight text={searchTerm}>{t('Fatal')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.ERROR:
      return (
        <LevelTag type="error">
          <Highlight text={searchTerm}>{t('Error')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.INFO:
      return (
        <LevelTag type="info">
          <Highlight text={searchTerm}>{t('Info')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.WARNING:
      return (
        <LevelTag type="warning">
          <Highlight text={searchTerm}>{t('Warning')}</Highlight>
        </LevelTag>
      );
    default:
      return (
        <LevelTag>
          <Highlight text={searchTerm}>{level || t('Undefined')}</Highlight>
        </LevelTag>
      );
  }
});

export default Level;

const LevelTag = styled(Tag)`
  height: 24px;
  display: flex;
  align-items: center;
  ${Background} {
    overflow: hidden;
  }
`;
