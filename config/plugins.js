
module.exports = ({ env }) => ({
	'vector-field': {
		enabled: true,
		resolve: './src/plugins/vector-field'
},
slugify: {
	enabled: false,
	config: {
			contentTypes: {
					"grupo-de-incrustacion": {
							field: 'slug',
							references: 'title',
					},
			},
	},
}


});
