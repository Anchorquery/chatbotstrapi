'use strict';

/**
 * temperature controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::temperature.temperature');
