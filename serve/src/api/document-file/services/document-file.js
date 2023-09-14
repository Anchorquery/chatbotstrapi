'use strict';

/**
 * document-file service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::document-file.document-file');
