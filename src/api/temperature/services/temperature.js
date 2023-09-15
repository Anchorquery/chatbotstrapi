'use strict';

/**
 * temperature service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::temperature.temperature');
