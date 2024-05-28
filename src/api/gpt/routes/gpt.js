'use strict';

/**
 * gpt router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::gpt.gpt');
