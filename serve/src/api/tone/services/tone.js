'use strict';

/**
 * tone service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::tone.tone');
