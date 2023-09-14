'use strict';

/**
 * promt service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::prompt.prompt');
