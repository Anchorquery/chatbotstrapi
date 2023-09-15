'use strict';

module.exports = ({ strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('vector-field')
      .service('myService')
      .getWelcomeMessage();
  },
});
