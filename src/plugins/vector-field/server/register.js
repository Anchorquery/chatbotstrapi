'use strict';

module.exports = ({ strapi }) => {
  strapi.customFields.register({
    name: 'vector',
    plugin: 'vector-field',
    type: 'vector',
  });
};
