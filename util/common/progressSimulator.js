class ProgressSimulator {
	constructor(socket = null, type = "image") {
			this.progress = 0;
			this.intervalId = null;
			this.isCancelled = false;
			this.socket = socket;
			this.type = type;
	}

	start(totalDuration = 30000) {
			return new Promise((resolve, reject) => {
					const interval = totalDuration / 100;

					this.intervalId = setInterval(() => {
							try {
									if (this.isCancelled) {
											clearInterval(this.intervalId);
											reject(new Error('Carga cancelada'));
											return;
									}

									this.progress += 1;
									if (this.socket) {
											this.socket.emit('porcentaje_carga', { message: this.progress, type: this.type });
									}

									if (this.progress >= 100) {
											clearInterval(this.intervalId);
											
											resolve('Carga completa');
									}
							} catch (error) {
									clearInterval(this.intervalId);
									reject(error);
							}
					}, interval);
			});
	}

	cancel() {
		this.socket.emit('porcentaje_carga', { message: 100, type: this.type });
			this.isCancelled = true;
			
	}
}

module.exports = { ProgressSimulator };
