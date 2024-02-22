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
	]
}