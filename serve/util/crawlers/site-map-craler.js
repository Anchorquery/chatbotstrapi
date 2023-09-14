'use strict';

const request = require('request');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const bluebird = require('bluebird');
const promiseMap = bluebird.map;
const delay = bluebird.delay;
const Url = require('url');
const path = require('path');
const zlib = require("zlib");

class SitemapXMLParser {
    constructor(url, options) {
        this.siteMapUrl = url;
        this.delayTime = options.delay ? options.delay : 3000;
        this.limit = options.limit ? options.limit : 5;
        this.urlArray = [];
								this.urlFilter = options.urlFilter;
    }

    async fetch() {
        // Obtener el XML de la página principal
        const indexBody = await this.getBodyFromURL(this.siteMapUrl);
        const indexXML = await this.executeParseXml(indexBody);
        // Obtener la lista de URLs
        await this.getURLFromXML(indexXML)
        // Lista de URLs del sitemap
        return this.urlArray;
    };


    async getURLFromURL(url) {
        let body = await this.getBodyFromURL(url);
        let sitemapData = await this.executeParseXml(body);
        await this.getURLFromXML(sitemapData);
        return delay(this.delayTime);
    }

    /**
     * Obtener URLs a partir del XML
     * Si es un archivo de índice de sitemap, accede a los enlaces y recopila URLs
     * @param {*} xml
     */
    async getURLFromXML(xml) {
        let sitemapIndexData = [];
        if (xml.sitemapindex && xml.sitemapindex.sitemap) {
            // Si es un archivo de índice de sitemap
            for (let i = 0; i < Object.keys(xml.sitemapindex.sitemap).length; i++) {
                sitemapIndexData.push(
                    {
                        url: xml.sitemapindex.sitemap[i].loc[0],
                        this: this
                        // TODO: Se incluye "this" en el arreglo debido a limitaciones de promiseMap, no es necesario
                        // promiseMap trabaja con referencias y los cambios en "this" dentro de promiseMap afectarán fuera de él
                    }
                );
            }

            // Acceder a cada archivo de índice de sitemap y obtener las URLs
            // Procesar múltiples archivos en paralelo según el límite especificado
            await promiseMap(
                sitemapIndexData,
                async (data) => {
                    let body = await data.this.getBodyFromURL(data.url);
                    let sitemapData = await data.this.executeParseXml(body);
                    await data.this.getURLFromXML(sitemapData);
                    return delay(data.this.delayTime);
                },
                { concurrency: this.limit }
            )
        }

        if (xml.urlset && xml.urlset.url) {
            // Si es un archivo de sitemap, agregar las URLs obtenidas
            for (let i = 0; i < Object.keys(xml.urlset.url).length; i++) {
                if (xml.urlset.url[i]) {
                    this.urlArray.push(xml.urlset.url[i]);
                }
            }
        }
    }

    /**
     * Obtener el cuerpo de una URL
     * Si la extensión es .gz, descomprime
     * @param {*} url 
     */
    async getBodyFromURL(url) {
        return new Promise(resolve => {
            // Verificar si la extensión es .gz
            let urlParse = Url.parse(url);
            let ext = path.extname(urlParse.path);
            if (ext == '.gz') {
                request(url, { encoding: null }, function (error, response, body) {
                    zlib.gunzip(body, function (error, result) {
                        resolve(result.toString());
                    });
                });
            } else {
                request(url, function (error, response, body) {
                    resolve(body.toString());
                });
            }
        });
    }


    /**
     * Realizar el análisis XML
     * @param {*} xml 
     */
    async executeParseXml(xml) {
        return new Promise(resolve => {
            parser.parseString(xml, (error, result) => {
                resolve(result);
            });
        })
    }
}

module.exports = SitemapXMLParser;
module.exports.default = SitemapXMLParser;
