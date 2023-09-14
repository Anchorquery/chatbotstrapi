'use strict';

/**
 * `bull-board` middleware
 */

module.exports = (config, { strapi }) => {
  // Add your own logic here.
  return async (ctx, next) => {
    strapi.log.info('In bull-board middleware.');

    await next();
  };
};
