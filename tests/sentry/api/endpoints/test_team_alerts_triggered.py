from freezegun import freeze_time

from sentry.incidents.models import (
    AlertRuleThresholdType,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
)
from sentry.models import ActorTuple
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamAlertsTriggeredTest(APITestCase):
    endpoint = "sentry-api-0-team-alerts-triggered"

    def test_simple(self):
        project1 = self.create_project(
            teams=[self.team], slug="foo"
        )  # This project will return counts for this team
        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="user owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        user_owned_incident = self.create_incident(status=20, alert_rule=user_owned_rule)
        activities = []
        for i in range(1, 9):
            activities.append(
                IncidentActivity(
                    incident=user_owned_incident,
                    type=IncidentActivityType.CREATED.value,
                    value=IncidentStatus.OPEN,
                    date_added=before_now(days=i),
                )
            )
        IncidentActivity.objects.bulk_create(activities)

        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        for i in range(1, 9):
            assert (
                response.data[
                    str(
                        before_now(days=i).replace(
                            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                        )
                    )
                ]
                == 1
            )

        for i in range(10, 90):
            assert (
                response.data[
                    str(
                        before_now(days=i).replace(
                            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                        )
                    )
                ]
                == 0
            )

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d"
        )
        assert len(response.data) == 7
        assert (
            response.data[
                str(
                    before_now(days=0).replace(
                        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                    )
                )
            ]
            == 0
        )
        for i in range(1, 6):
            assert (
                response.data[
                    str(
                        before_now(days=i).replace(
                            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                        )
                    )
                ]
                == 1
            )

    def test_not_as_simple(self):
        team_with_user = self.create_team(
            organization=self.organization, name="Lonely Team", members=[self.user]
        )

        project1 = self.create_project(
            teams=[self.team], slug="foo"
        )  # This project will return counts for this team
        project2 = self.create_project(
            # teams=[team_with_user], slug="bar"
            teams=[team_with_user],
            slug="bar",
        )  # but not this project, cause this team isn't on it (but the user is)

        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project2],
            name="user owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        user_owned_incident = self.create_incident(
            projects=[project2], status=20, alert_rule=user_owned_rule
        )
        team_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="team owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(f"team:{self.team.id}"),
        )
        team_owned_incident = self.create_incident(
            projects=[project1], status=20, alert_rule=team_owned_rule
        )
        IncidentActivity.objects.create(
            incident=user_owned_incident,
            type=IncidentActivityType.CREATED.value,
            value=IncidentStatus.OPEN,
        )
        IncidentActivity.objects.create(
            incident=team_owned_incident,
            type=IncidentActivityType.CREATED.value,
            value=IncidentStatus.OPEN,
            date_added=before_now(days=2),
        )

        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        assert (
            response.data[
                str(
                    before_now(days=2).replace(
                        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                    )
                )
            ]
            == 1
        )
        # only getting the team owned incident, because the user owned incident is for another project that the team isn't on
        for i in range(0, 90):
            if i != 2:
                assert (
                    response.data[
                        str(
                            before_now(days=i).replace(
                                hour=0, minute=0, second=0, microsecond=0, tzinfo=None
                            )
                        )
                    ]
                    == 0
                )
