'use strict';

/**
 * gpt controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::gpt.gpt');
