from io import BytesIO
from zipfile import ZipFile

import requests
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.types import (
    CloudFunction,
    EventTrigger,
    GenerateUploadUrlRequest,
    UpdateFunctionRequest,
)
from google.cloud.functions_v1.types.functions import DeleteFunctionRequest
from google.cloud.pubsub_v1 import PublisherClient
from google.protobuf.field_mask_pb2 import FieldMask

from sentry.utils import json

WRAPPER_JS = """
const userFunc = require('./user.js');
Object.assign(process.env, require('./env.json'));
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

exports.start = async (message, context) => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
      ],
      tracesSampleRate: 1.0,
    });
  }
  if (!userFunc) {
    console.error("Your code needs to export a function. module.export = () => {}");
    return;
  }
  if (typeof userFunc !== 'function') {
    console.error("Your code needs to export a function. Instead, " + typeof userFunc + " was exported.");
    return;
  }
  const event = JSON.parse(Buffer.from(message.data, 'base64').toString());

  if (process.env.SENTRY_DSN) {
    const transaction = Sentry.startTransaction({
        op: "func",
        name: "Sentry Function Transaction",
    });
    try {
        await userFunc(event.data, event.type);
    } catch (e) {
        Sentry.captureException(e);
    } finally {
        transaction.finish();
    }
  } else {
      await userFunc(event.data, event.type);
  }
};
"""


PACKAGE_JSON = {
    "dependencies": {
        "@sentry/node": "^6.11.0",
        "@sentry/tracing": "^6.11.0",
        "node-fetch": "^2.6.1",
    }
}


def function_pubsub_name(funcId):
    return "projects/hackweek-sentry-functions/topics/fn-" + funcId


def create_function_pubsub_topic(funcId):
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))


def upload_function_files(client, code, env):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("user.js", code)
        codezip.writestr("index.js", WRAPPER_JS)
        codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        codezip.writestr("env.json", json.dumps(env))
    f.seek(0)

    upload_url = client.generate_upload_url(
        request=GenerateUploadUrlRequest(
            parent="projects/hackweek-sentry-functions/locations/us-central1"
        )
    ).upload_url
    requests.put(
        upload_url,
        data=f,
        headers={"content-type": "application/zip", "x-goog-content-length-range": "0,104857600"},
    )
    return upload_url


def update_function(code, funcId, env_variables, description):
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files(client, code, env_variables)
    client.update_function(
        request=UpdateFunctionRequest(
            function=CloudFunction(
                name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-"
                + funcId,
                description=description,
                source_upload_url=upload_url,
                runtime="nodejs14",
                entry_point="start",
                event_trigger=EventTrigger(
                    event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                    resource=function_pubsub_name(funcId),
                ),
                environment_variables=env_variables,
            ),
            update_mask=FieldMask(paths=["source_upload_url"]),
        )
    )


def create_function(code, funcId, env_variables, description):
    create_function_pubsub_topic(funcId)
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files(client, code, env_variables)
    client.create_function(
        function=CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
            description=description,
            source_upload_url=upload_url,
            runtime="nodejs14",
            entry_point="start",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=function_pubsub_name(funcId),
            ),
            environment_variables=env_variables,
        ),
        location="projects/hackweek-sentry-functions/locations/us-central1",
    )


def delete_function(funcId):
    client = CloudFunctionsServiceClient()
    client.delete_function(
        request=DeleteFunctionRequest(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
        ),
    )
