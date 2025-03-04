import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import EventView from 'app/utils/discover/eventView';
import DiscoverBanner from 'app/views/eventsV2/banner';
import {ALL_VIEWS} from 'app/views/eventsV2/data';
import SavedQueryButtonGroup from 'app/views/eventsV2/savedQuery';
import * as utils from 'app/views/eventsV2/savedQuery/utils';

const SELECTOR_BUTTON_SAVE_AS = 'button[aria-label="Save as"]';
const SELECTOR_BUTTON_SAVED = '[data-test-id="discover2-savedquery-button-saved"]';
const SELECTOR_BUTTON_UPDATE = '[data-test-id="discover2-savedquery-button-update"]';
const SELECTOR_BUTTON_DELETE = '[data-test-id="discover2-savedquery-button-delete"]';
const SELECTOR_BUTTON_CREATE_ALERT = '[data-test-id="discover2-create-from-discover"]';

function generateWrappedComponent(
  location,
  organization,
  eventView,
  savedQuery,
  yAxis,
  disabled = false
) {
  return mountWithTheme(
    <SavedQueryButtonGroup
      location={location}
      organization={organization}
      eventView={eventView}
      savedQuery={savedQuery}
      disabled={disabled}
      updateCallback={() => {}}
      yAxis={yAxis}
    />,
    TestStubs.routerContext()
  );
}

describe('EventsV2 > SaveQueryButtonGroup', function () {
  // Organization + Location does not affect state in this component
  const organization = TestStubs.Organization({
    features: ['discover-query', 'connect-discover-and-dashboards', 'dashboards-edit'],
  });
  const location = {
    pathname: '/organization/eventsv2/',
    query: {},
  };
  const yAxis = ['count()', 'failure_count()'];

  const errorsQuery = {
    ...ALL_VIEWS.find(view => view.name === 'Errors by Title'),
    yAxis: 'count()',
  };
  const errorsView = EventView.fromSavedQuery(errorsQuery);

  const errorsViewSaved = EventView.fromSavedQuery(errorsQuery);
  errorsViewSaved.id = '1';

  const errorsViewModified = EventView.fromSavedQuery(errorsQuery);
  errorsViewModified.id = '1';
  errorsViewModified.name = 'Modified Name';

  const savedQuery = {...errorsViewSaved.toNewQuery(), yAxis};

  describe('building on a new query', () => {
    const mockUtils = jest
      .spyOn(utils, 'handleCreateQuery')
      .mockImplementation(() => Promise.resolve(savedQuery));

    beforeEach(() => {
      mockUtils.mockClear();
    });

    it('renders disabled buttons when disabled prop is used', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsView,
        undefined,
        yAxis,
        true
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      expect(buttonSaveAs.props()['aria-disabled']).toBe(true);
    });

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsView,
        undefined,
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(true);
      expect(buttonSaved.exists()).toBe(false);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(false);
    });

    it('hides the banner when save is complete.', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Fill in the Input
      buttonSaveAs
        .find('ButtonSaveInput')
        .simulate('change', {target: {value: 'My New Query Name'}}); // currentTarget.value does not work
      await tick();

      // Click on Save in the Dropdown
      await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

      // The banner should not render
      const banner = mountWithTheme(<DiscoverBanner />);
      expect(banner.find('BannerTitle').exists()).toBe(false);
    });

    it('saves a well-formed query', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Fill in the Input
      buttonSaveAs
        .find('ButtonSaveInput')
        .simulate('change', {target: {value: 'My New Query Name'}}); // currentTarget.value does not work
      await tick();

      // Click on Save in the Dropdown
      await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

      expect(mockUtils).toHaveBeenCalledWith(
        expect.anything(), // api
        organization,
        expect.objectContaining({
          ...errorsView,
          name: 'My New Query Name',
        }),
        yAxis,
        true
      );
    });

    it('rejects if query.name is empty', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Do not fill in Input
      await tick();

      // Click on Save in the Dropdown
      buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

      // Check that EventView has a name
      expect(errorsView.name).toBe('Errors by Title');

      expect(mockUtils).not.toHaveBeenCalled();
    });
  });

  describe('viewing a saved query', () => {
    let mockUtils;

    beforeEach(() => {
      mockUtils = jest
        .spyOn(utils, 'handleDeleteQuery')
        .mockImplementation(() => Promise.resolve(savedQuery));
    });

    afterEach(() => {
      mockUtils.mockClear();
    });

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewSaved,
        savedQuery,
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('treats undefined yAxis the same as count() when checking for changes', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewSaved,
        {...savedQuery, yAxis: undefined},
        ['count()']
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('converts string yAxis values to array when checking for changes', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewSaved,
        {...savedQuery, yAxis: 'count()'},
        ['count()']
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('deletes the saved query', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewSaved,
        savedQuery,
        yAxis
      );

      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE).first();
      await buttonDelete.simulate('click');

      expect(mockUtils).toHaveBeenCalledWith(
        expect.anything(), // api
        organization,
        expect.objectContaining({id: '1'})
      );
    });
  });

  describe('modifying a saved query', () => {
    let mockUtils;

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewModified,
        errorsViewSaved.toNewQuery(),
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(true);
      expect(buttonSaved.exists()).toBe(false);
      expect(buttonUpdate.exists()).toBe(true);
      expect(buttonDelete.exists()).toBe(true);
    });

    describe('updates the saved query', () => {
      beforeEach(() => {
        mockUtils = jest
          .spyOn(utils, 'handleUpdateQuery')
          .mockImplementation(() => Promise.resolve(savedQuery));
      });

      afterEach(() => {
        mockUtils.mockClear();
      });

      it('accepts a well-formed query', async () => {
        const wrapper = generateWrappedComponent(
          location,
          organization,
          errorsViewModified,
          savedQuery,
          yAxis
        );

        // Click on Save in the Dropdown
        const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE).first();
        await buttonUpdate.simulate('click');

        expect(mockUtils).toHaveBeenCalledWith(
          expect.anything(), // api
          organization,
          expect.objectContaining({
            ...errorsViewModified,
          }),
          yAxis
        );
      });
    });

    describe('creates a separate query', () => {
      beforeEach(() => {
        mockUtils = jest
          .spyOn(utils, 'handleCreateQuery')
          .mockImplementation(() => Promise.resolve(savedQuery));
      });

      afterEach(() => {
        mockUtils.mockClear();
      });

      it('checks that it is forked from a saved query', async () => {
        const wrapper = generateWrappedComponent(
          location,
          organization,
          errorsViewModified,
          savedQuery,
          yAxis
        );

        // Click on ButtonSaveAs to open dropdown
        const buttonSaveAs = wrapper.find('DropdownControl').first();
        buttonSaveAs.simulate('click');

        // Fill in the Input
        buttonSaveAs
          .find('ButtonSaveInput')
          .simulate('change', {target: {value: 'Forked Query'}});
        await tick();

        // Click on Save in the Dropdown
        await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

        expect(mockUtils).toHaveBeenCalledWith(
          expect.anything(), // api
          organization,
          expect.objectContaining({
            ...errorsViewModified,
            name: 'Forked Query',
          }),
          yAxis,
          false
        );
      });
    });
  });
  describe('create alert from discover', () => {
    it('renders create alert button when metrics alerts is enabled', () => {
      const metricAlertOrg = {
        ...organization,
        features: ['incidents'],
      };
      const wrapper = generateWrappedComponent(
        location,
        metricAlertOrg,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      const buttonCreateAlert = wrapper.find(SELECTOR_BUTTON_CREATE_ALERT);

      expect(buttonCreateAlert.exists()).toBe(true);
    });
    it('does not render create alert button without metric alerts', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      const buttonCreateAlert = wrapper.find(SELECTOR_BUTTON_CREATE_ALERT);

      expect(buttonCreateAlert.exists()).toBe(false);
    });
  });
  describe('add dashboard widget', () => {
    it('opens widget modal when add to dashboard is clicked', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      wrapper.find('DiscoverQueryMenu').find('Button').first().simulate('click');
      wrapper.find('MenuItem').first().simulate('click');
      await tick();
      await wrapper.update();
      const modal = await mountGlobalModal();
      expect(modal.find('AddDashboardWidgetModal').find('h4').children().html()).toEqual(
        'Add Widget to Dashboard'
      );
    });
  });
});
