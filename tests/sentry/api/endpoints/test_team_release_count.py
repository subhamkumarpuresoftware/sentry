from sentry.models import Release
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


class TeamReleaseCountTest(APITestCase):
    endpoint = "sentry-api-0-team-release-count"

    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=before_now(days=15)
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=before_now(days=12)
        )  # This release isn't returned, its in another org
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=before_now(days=10),
            date_released=before_now(days=10),
        )
        release3.add_project(project1)

        release4 = Release.objects.create(
            organization_id=org.id, version="4", date_added=before_now(days=5)
        )
        release4.add_project(project3)
        release5 = Release.objects.create(
            organization_id=org.id, version="5", date_added=before_now(days=5)
        )
        release5.add_project(project3)
        response = self.get_valid_response(org.slug, team1.slug)
        assert len(response.data) == 2
        assert project2.id not in response.data
        assert len(response.data[project3.id]) == 90
        assert (
            response.data[project3.id][
                str(before_now(days=5).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 2
        )
        assert (
            response.data[project3.id][
                str(before_now(days=0).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 0
        )

        assert (
            response.data[project1.id][
                str(before_now(days=15).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 1
        )
        assert (
            response.data[project1.id][
                str(before_now(days=10).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 1
        )

    def test_multi_project_release(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=before_now(days=15)
        )
        release1.add_project(project1)
        release1.add_project(project3)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=before_now(days=12)
        )  # This release isn't returned, its in another org
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=before_now(days=10),
            date_released=before_now(days=10),
        )
        release3.add_project(project1)

        release4 = Release.objects.create(
            organization_id=org.id, version="4", date_added=before_now(days=5)
        )
        release4.add_project(project3)
        release5 = Release.objects.create(
            organization_id=org.id, version="5", date_added=before_now(days=5)
        )
        release5.add_project(project3)
        response = self.get_valid_response(org.slug, team1.slug)
        assert len(response.data) == 2
        assert project2.id not in response.data
        assert (
            response.data[project3.id][
                str(before_now(days=15).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 1
        )
        assert (
            response.data[project3.id][
                str(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 0
        )

        assert (
            response.data[project3.id][
                str(before_now(days=5).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 2
        )
        assert (
            response.data[project3.id][
                str(before_now(days=0).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 0
        )

        assert (
            response.data[project1.id][
                str(before_now(days=15).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 1
        )
        assert (
            response.data[project1.id][
                str(before_now(days=5).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 0
        )

        assert (
            response.data[project1.id][
                str(before_now(days=10).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 1
        )
        assert (
            response.data[project1.id][
                str(before_now(days=0).replace(hour=0, minute=0, second=0, microsecond=0))
            ]
            == 0
        )
