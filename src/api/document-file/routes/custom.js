module.exports = {
	routes: [
		{
			method: 'POST',
			path: '/folder-clients',
			handler: 'document-file.createFolder',
			prefix : ''
		},
		{
			method: 'GET',
			path: '/find-infobase',
			handler: 'document-file.findInfobase',
			prefix : ''
		},
    { // Path defined with a URL parameter
      method: 'POST',
      path: '/infobase/delete-many',
      handler: 'document-file.deleteMany',
      refix: '',
      config: {
        prefix: '',
      }
    },
    { // Path defined with a URL parameter
      method: 'GET',
      path: '/infobase/get-data/:uuid',
      handler: 'document-file.getInfobaseData',
      refix: '',
      config: {
        prefix: '',
      }
    },

	]
}
