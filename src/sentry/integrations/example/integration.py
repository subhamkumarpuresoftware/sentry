from typing import Any, Optional

from django.http import HttpResponse

from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.issues import IssueSyncMixin
from sentry.mediators.plugins import Migrator
from sentry.models import ExternalIssue, User
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError


class ExampleSetupView(PipelineView):
    TEMPLATE = """
        <form method="POST">
            <p>This is an example integration configuration page.</p>
            <p><label>Integration Name:</label></p>
            <p><input type="name" name="name" /></p>
            <p><input type="submit" value="Continue" /></p>
        </form>
    """

    def dispatch(self, request, pipeline):
        if "name" in request.POST:
            pipeline.bind_state("name", request.POST["name"])
            return pipeline.next_step()

        return HttpResponse(self.TEMPLATE)


DESCRIPTION = """
This is an example integration. Descriptions support _markdown rendering_.
"""

FEATURES = [
    FeatureDescription(
        "This is a feature description. Also *supports markdown*", IntegrationFeatures.ISSUE_SYNC
    )
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun="example",
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem",
    source_url="https://github.com/getsentry/sentry",
    aspects={},
)


class ExampleIntegration(IntegrationInstallation, IssueSyncMixin):
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_outbound"
    inbound_status_key = "sync_status_inbound"
    outbound_assignee_key = "sync_assignee_outbound"
    inbound_assignee_key = "sync_assignee_inbound"

    def get_issue_url(self, key):
        return f"https://example/issues/{key}"

    def create_comment(self, issue_id, user_id, group_note):
        user = User.objects.get(id=user_id)
        attribution = f"{user.name} wrote:\n\n"
        comment = {
            "id": "123456789",
            "text": "{}<blockquote>{}</blockquote>".format(attribution, group_note.data["text"]),
        }
        return comment

    def get_persisted_default_config_fields(self):
        return ["project", "issueType"]

    def get_persisted_user_default_config_fields(self):
        return ["assignedTo", "reportedBy"]

    def get_create_issue_config(self, group, user, **kwargs):
        kwargs["link_referrer"] = "example_integration"
        fields = super().get_create_issue_config(group, user, **kwargs)
        default = self.get_project_defaults(group.project_id)
        example_project_field = self.generate_example_project_field(default)
        return fields + [example_project_field]

    def generate_example_project_field(self, default_fields):
        project_field = {
            "name": "project",
            "label": "Project",
            "choices": [("1", "Project 1"), ("2", "Project 2")],
            "type": "select",
        }

        default_project = default_fields.get("project")
        if default_project is not None:
            project_field["default"] = default_project

        return project_field

    def get_link_issue_config(self, group, **kwargs):
        fields = super().get_link_issue_config(group, **kwargs)
        default = self.get_project_defaults(group.project_id)
        example_project_field = self.generate_example_project_field(default)
        return fields + [example_project_field]

    def create_issue(self, data, **kwargs):
        if "assignee" not in data:
            raise IntegrationError("Assignee is required")
        return {
            "key": "APP-123",
            "title": "This is a test external issue title",
            "description": "This is a test external issue description",
        }

    def get_issue(self, issue_id, **kwargs):
        return {
            "key": issue_id,
            "title": "This is a test external issue title",
            "description": "This is a test external issue description",
        }

    def get_repositories(self):
        return [{"name": "repo", "identifier": "user/repo"}]

    def get_unmigratable_repositories(self):
        return []

    def sync_assignee_outbound(
        self,
        external_issue: "ExternalIssue",
        user: Optional["User"],
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        pass

    def sync_status_outbound(self, external_issue, is_resolved, project_id):
        pass

    def should_unresolve(self, data):
        return data["status"]["category"] != "done"

    def should_resolve(self, data):
        return data["status"]["category"] == "done"

    def get_issue_display_name(self, external_issue):
        return "display name: %s" % external_issue.key

    def get_stacktrace_link(self, repo, path, default, version):
        pass

    def format_source_url(self, repo, filepath, branch):
        return f"https://example.com/{repo.name}/blob/{branch}/{filepath}"


class ExampleIntegrationProvider(IntegrationProvider):
    """
    An example integration, generally used for testing.
    """

    key = "example"
    name = "Example"
    metadata = metadata

    integration_cls = ExampleIntegration

    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.STACKTRACE_LINK,
        ]
    )

    def get_pipeline_views(self):
        return [ExampleSetupView()]

    def get_config(self):
        return [{"name": "name", "label": "Name", "type": "text", "required": True}]

    def post_install(self, integration, organization, extra=None):
        Migrator.run(integration=integration, organization=organization)

    def build_integration(self, state):
        return {"external_id": state["name"]}

    def setup(self):
        """
        Executed once Sentry has been initialized at runtime.

        >>> def setup(self):
        >>>     bindings.add('repository.provider', GitHubRepositoryProvider, key='github')
        """


class AliasedIntegration(ExampleIntegration):
    pass


class AliasedIntegrationProvider(ExampleIntegrationProvider):
    key = "aliased"
    integration_key = "example"
    name = "Integration Key Example"


class ServerExampleProvider(ExampleIntegrationProvider):
    key = "example_server"
    name = "Example Server"


class FeatureFlagIntegration(ExampleIntegrationProvider):
    key = "feature_flag_integration"
    name = "Feature Flag Integration"
    requires_feature_flag = True


class AlertRuleIntegrationProvider(ExampleIntegrationProvider):
    key = "alert_rule_integration"
    name = "Alert Rule Integration"
    features = frozenset([IntegrationFeatures.ALERT_RULE])
