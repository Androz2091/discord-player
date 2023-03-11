FROM node:18-slim

LABEL com.github.actions.name="Publish to NPM"
LABEL com.github.actions.description="Builds and publishes the npm package."
LABEL com.github.actions.icon="upload-cloud"
LABEL com.github.actions.color="red"

RUN apt-get update && apt-get install -y git

COPY src /actions/npm/src
ENTRYPOINT ["/actions/npm/src/entrypoint.sh"]