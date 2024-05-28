
module.exports = {
	routes: [
			{ // Path defined with a URL parameter
					method: 'GET',
					path: '/clients/get-perfil/:uuid',
					handler: 'client.findOnePerfil',
					refix:	'',
					config:{
						prefix:	'',
					}
			},
			{ // Path defined with a URL parameter
				method: 'PUT',
				path: '/clients/update-client/:uuid',
				handler: 'client.updateClient',
				config: {
					// @ts-ignore
					roles: ["authenticated"],
			},
		},
		
		{ // Path defined with a URL parameter
			method: 'PUT',
			path: '/clients/update-logo/:uuid',
			handler: 'client.updateLogo',
			config: {
				// @ts-ignore
				roles: ["authenticated"],
		},
	},
	]
} 