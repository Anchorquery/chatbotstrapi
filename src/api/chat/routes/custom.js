
module.exports = {
	routes: [
			{ // Path defined with a URL parameter
					method: 'POST',
					path: '/copy',
					handler: 'chat.createCopy',
					refix:	'',
					config:{
						prefix:	'',
					}
			},

	]
}
