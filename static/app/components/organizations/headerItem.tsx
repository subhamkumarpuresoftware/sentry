import * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {IconChevron, IconClose, IconInfo, IconLock, IconSettings} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type DefaultProps = {
  allowClear: boolean;
};

type Props = {
  icon: React.ReactNode;
  hasChanges?: boolean;
  hasSelected?: boolean;
  isOpen?: boolean;
  locked?: boolean;
  loading?: boolean;
  hint?: string;
  settingsLink?: string;
  lockedMessage?: React.ReactNode;
  forwardRef?: React.Ref<HTMLDivElement>;
  onClear?: () => void;
} & Partial<DefaultProps> &
  React.HTMLAttributes<HTMLDivElement>;

function HeaderItem({
  children,
  isOpen,
  hasSelected,
  icon,
  locked,
  lockedMessage,
  settingsLink,
  hint,
  loading,
  forwardRef,
  onClear,
  allowClear = true,
  ...props
}: Props) {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
  };

  const textColorProps = {
    locked,
    isOpen,
    hasSelected,
  };

  return (
    <StyledHeaderItem
      ref={forwardRef}
      loading={!!loading}
      {...omit(props, 'onClear')}
      {...textColorProps}
    >
      <IconContainer {...textColorProps}>{icon}</IconContainer>
      <Content>
        <StyledContent>{children}</StyledContent>

        {settingsLink && (
          <SettingsIconLink to={settingsLink}>
            <IconSettings />
          </SettingsIconLink>
        )}
      </Content>
      {hint && (
        <Hint>
          <Tooltip title={hint} position="bottom">
            <IconInfo size="sm" />
          </Tooltip>
        </Hint>
      )}
      {hasSelected && !locked && allowClear && (
        <StyledClose {...textColorProps} onClick={handleClear} />
      )}
      {!locked && !loading && (
        <ChevronWrapper>
          <StyledChevron isOpen={!!isOpen} direction={isOpen ? 'up' : 'down'} size="sm" />
        </ChevronWrapper>
      )}
      {locked && (
        <Tooltip title={lockedMessage || t('This selection is locked')} position="bottom">
          <StyledLock color="gray300" />
        </Tooltip>
      )}
    </StyledHeaderItem>
  );
}

// Infer props here because of styled/theme
const getColor = (p: ColorProps & {theme: Theme}) => {
  if (p.locked) {
    return p.theme.gray300;
  }
  return p.isOpen || p.hasSelected ? p.theme.textColor : p.theme.gray300;
};

type ColorProps = {
  locked?: boolean;
  isOpen?: boolean;
  hasSelected?: boolean;
};

const StyledHeaderItem = styled('div', {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'loading',
})<
  ColorProps & {
    loading: boolean;
  }
>`
  display: flex;
  padding: 0 ${space(4)};
  align-items: center;
  cursor: ${p => (p.loading ? 'progress' : p.locked ? 'text' : 'pointer')};
  color: ${getColor};
  transition: 0.1s color;
  user-select: none;
`;

const Content = styled('div')`
  display: flex;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  margin-right: ${space(1.5)};
`;

const StyledContent = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IconContainer = styled('span', {shouldForwardProp: isPropValid})<ColorProps>`
  color: ${getColor};
  margin-right: ${space(1.5)};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Hint = styled('div')`
  position: relative;
  top: ${space(0.25)};
  margin-right: ${space(1)};
`;

const StyledClose = styled(IconClose, {shouldForwardProp: isPropValid})<ColorProps>`
  color: ${getColor};
  height: ${space(1.5)};
  width: ${space(1.5)};
  stroke-width: 1.5;
  padding: ${space(1)};
  box-sizing: content-box;
  margin: -${space(1)} 0px -${space(1)} -${space(1)};
`;

const ChevronWrapper = styled('div')`
  width: ${space(2)};
  height: ${space(2)};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledChevron = styled(IconChevron, {shouldForwardProp: isPropValid})<{
  isOpen: boolean;
}>`
  color: ${getColor};
`;

export const SettingsIconLink = styled(Link)`
  color: ${p => p.theme.gray300};
  align-items: center;
  display: inline-flex;
  justify-content: space-between;
  margin-right: ${space(1.5)};
  margin-left: ${space(1.0)};
  transition: 0.5s opacity ease-out;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledLock = styled(IconLock)`
  margin-top: ${space(0.75)};
  stroke-width: 1.5;
`;

export default React.forwardRef<HTMLDivElement, Props>((props, ref) => (
  <HeaderItem forwardRef={ref} {...props} />
));
