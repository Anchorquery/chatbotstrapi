class ProgressSimulator {
	constructor(socket, type = "image") {
		this.progress = 0;
		this.intervalId = null;
		this.isCancelled = false;
		this.socket = socket;
		this.type = type;
	}

	start(interval = 100) {
		return new Promise((resolve, reject) => {
			this.intervalId = setInterval(() => {
				if (this.isCancelled) {
					clearInterval(this.intervalId);
					reject(new Error('Carga cancelada'));
					return;
				}

				this.progress += 1;
				this.socket.emit('porcentaje_carga', { message: this.progress , type: this.type});


				if (this.progress >= 100) {
					clearInterval(this.intervalId);
					resolve('Carga completa');
				}
			}, interval);
		});
	}

	cancel() {
		this.isCancelled = true;
	}
}

// Ejemplo de uso
//const simulator = new ProgressSimulator();

module.exports = {ProgressSimulator};

/*simulator.start()
	.then(message => {
		console.log(message);
	})
	.catch(error => {
		console.error(error.message);
	});

// Cancelar después de 3 segundos
setTimeout(() => {
	simulator.cancel();
}, 3000);*/
