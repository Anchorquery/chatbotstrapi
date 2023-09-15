module.exports = [
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      patchKoa: true,
      multipart: true,
      includeUnparsed: true,
      parseLimit: '5mb',
      jsonLimit	: '250mb',
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
