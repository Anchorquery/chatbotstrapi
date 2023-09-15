const uuid = require('uuid');

module.exports = {

	beforeCreate(event) {

		event.params.data.uuid = uuid.v4();
	
	}
};