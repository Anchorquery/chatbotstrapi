
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
			{

				
				method: 'PUT',
				path: '/chats/update-title/:uuid',
				handler: 'chat.updateTitle',
				refix:	'',
				config:{
					prefix:	'',
				}
			}

	]
}
