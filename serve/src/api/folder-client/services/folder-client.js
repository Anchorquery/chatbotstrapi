'use strict';

/**
 * folder-client service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::folder-client.folder-client');
