'use strict';

/**
 * teamspace service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::teamspace.teamspace');
