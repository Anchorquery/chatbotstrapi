'use strict';

/**
 * chat service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::document.document');
