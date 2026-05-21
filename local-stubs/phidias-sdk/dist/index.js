'use strict';

const PHIDIAS_TAG = 'phidias-viewer';
const PHIDIAS_ATTRS = {
  BASE_PATH: 'base-path',
  API_BASE_URL: 'api-base-url',
  HOST_APP: 'host-app',
  USER: 'user',
};
const PHIDIAS_EVENTS = {
  JOB_COMPLETE: 'phidias:job-complete',
  JOB_ERROR: 'phidias:job-error',
  JOB_PROGRESS: 'phidias:job-progress',
  GET_ASSETS: 'phidias:get-assets',
  UPLOAD_ASSETS: 'phidias:upload-assets',
  ERROR: 'phidias:error',
};

function getPhidiasRequestConfig() {
  return {
    defaultTimeout: 30000,
    getAuthToken: async () => null,
    onAuthFailure: () => {},
    onRequest: async (_url, init) => init,
    retryDelay: () => 1000,
    shouldRetry: () => false,
    onError: () => {},
  };
}
function configurePhidiasRequest() {}

module.exports = {
  PHIDIAS_TAG,
  PHIDIAS_ATTRS,
  PHIDIAS_EVENTS,
  getPhidiasRequestConfig,
  configurePhidiasRequest,
};
