'use strict';

const PHIDIAS_TAG = 'phidias-viewer';
const PHIDIAS_ATTRS = {};
const PHIDIAS_EVENTS = {
  JOB_COMPLETE: 'phidias:job-complete',
  JOB_ERROR: 'phidias:job-error',
  JOB_PROGRESS: 'phidias:job-progress',
};

function getPhidiasRequestConfig() { return {}; }
function configurePhidiasRequest() {}

module.exports = {
  PHIDIAS_TAG,
  PHIDIAS_ATTRS,
  PHIDIAS_EVENTS,
  getPhidiasRequestConfig,
  configurePhidiasRequest,
};
