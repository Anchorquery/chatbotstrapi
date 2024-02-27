'use strict';

const { winston, formats: { prettyPrint, levelFilter } } = require('@strapi/logger');
const path = require('path');

module.exports = {
  transports: [
    // Transporte para la consola
    new winston.transports.Console({
      level: 'silly', // Ajusta para capturar desde debug
      format: winston.format.combine(
        levelFilter('silly'), // Usa 'debug' para permitir todo desde debug en adelante
        prettyPrint({ timestamps: 'YYYY-MM-DD hh:mm:ss.SSS' })
      ),
    }),
    // Transporte para archivo
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'strapi.log'),
      level: 'silly', // Ajusta para capturar desde debug
      format: winston.format.combine(
        levelFilter('silly'), // Asegura que el archivo también capture desde debug
        prettyPrint({ timestamps: 'YYYY-MM-DD hh:mm:ss.SSS' })
      ),
    })
  ],
};
