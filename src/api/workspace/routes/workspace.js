'use strict';

/**
 * workspace router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::workspace.workspace');
