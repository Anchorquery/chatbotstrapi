'use strict';

/**
 * promt router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::prompt.prompt');
