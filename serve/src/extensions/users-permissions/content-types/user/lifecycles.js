const uuid = require('uuid');

module.exports = {

	beforeCreate(event) {

		event.params.data.uuid = uuid.v4();
	
	},
	beforeUpdate(event) {

		// verifico si el campo	uuid está lleno o no

		if (!event.params.data.uuid) {

			// si no está lleno, le asigno un uuid

			event.params.data.uuid = uuid.v4();

		}
},
};