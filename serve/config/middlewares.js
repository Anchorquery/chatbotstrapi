module.exports = [
  'strapi::errors',
  'strapi::security',
  'strapi::poweredBy',
  // modiico con el middleware de cors
  {
    name: 'strapi::cors',
    config: {
      
      origin: ['app-ia.adaki.com', 'http://app-ia.adaki.com', '*'],
    
    },

  },
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
