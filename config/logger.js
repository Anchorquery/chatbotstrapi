'use strict';

const winston = require('winston');
const path = require('path');

module.exports = ({ env }) => ({
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'strapi.log'),
      level: 'debug', // Captura desde debug hasta los niveles más críticos
    }),
    new winston.transports.Console({
      level: 'silly', 
    })
  ],
});
