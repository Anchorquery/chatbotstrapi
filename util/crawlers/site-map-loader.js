const SitemapXMLParser =  require('./site-map-craler');

class SiteMapLoader {
  constructor(sitemap, filterUrl = [], blocksize = 0,blocknum = 0 , minLenChar = 200) {
    this.pages = [];
				this.sitemap = sitemap;
				this.filterUrl = filterUrl;
				this.blocksize = blocksize;
				this.blocknum = blocknum;
				this.minLenChar = minLenChar;
  }
		async  parseSitmap(url, filter, limit) {
			const options = {
					delay: 4000,
					limit: 5,
			};
	
			const sitemapXMLParser = new SitemapXMLParser(url, options);
	
			try {
					const result = await sitemapXMLParser.fetch();
					const list = result
							.map((item) => item.loc[0].trim().replace(/\r\n/g, ' '))
							.filter((item) => !filter || item.includes(filter));

					return limit ? list.slice(0, limit) : list;
			} catch (error) {
					// Manejar cualquier error que pueda ocurrir al realizar la operación asincrónica.
					console.error('Error al parsear el sitemap:', error);
					return []; // Otra opción podría ser lanzar una excepción aquí.
			}
	}

		async load() {
				try {


					let url =	await this.parseSitmap(this.sitemap, this.filterUrl, this.blocksize);
					return	url;

				} catch (err) {
						strapi.log.debug(err);
				}
		}




}

module.exports = { SiteMapLoader };
