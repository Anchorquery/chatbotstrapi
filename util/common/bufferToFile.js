const axios = require('axios').default;
const { Readable } = require('stream');
const fse = require('fs-extra');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const { v4: uuid } = require('uuid');
async function bufferToFile(buffer, file, related = null) {
    const tmpWorkingDirectory = await fse.mkdtemp(path.join(os.tmpdir(), 'strapi-upload-'));

    const result = {
        name: `${file.name}`,
        hash: file.hash,
        ext: "." + file.ext,
        mime: file.mime,
        size: convbyteToKB(file.size),
        provider: 'local',
        tmpWorkingDirectory: tmpWorkingDirectory,
        getStream: () => Readable.from(buffer),
    };

    if (related) {
        result.related = {
            id: related.id,
            __type: related.type, // 'api::grupo-de-incrustacion.grupo-de-incrustacion'
            __pivot: { field: related.pivot } // media
        };
    }

    return result;
}

function convbyteToKB(bytes) {
    return bytes / 1024;
}

function generateHash(buffer) {
	return crypto.createHash('md5').update(buffer).digest('hex');
}

async function downloadFileToNetwork(response) {
	const { messageImage } = response;
	const { fileTypeFromBuffer } = await import('file-type');
	try {
					const imageResponse = await axios({
									url: messageImage,
									method: 'GET',
									responseType: 'arraybuffer'
					});

					const buffer = Buffer.from(imageResponse.data, 'binary');
					const type = await fileTypeFromBuffer(buffer);
					const fileName = path.basename(new URL(messageImage).pathname);

					const file = {
									name: fileName,
									mime: type.mime,
									ext: type.ext,
									size: buffer.length,
									hash: `${uuid()}_${generateHash(buffer)}`
					};



					const fileInfo = await bufferToFile(buffer, file);

					

					const mediaUpload = await strapi.plugin('upload').service('upload').uploadFileAndPersist(fileInfo);

					await strapi.query("plugin::upload.file").create({ data: fileInfo });
 

					return {
						error: false,
						message: "Archivo guardado correctamente",
						file: process.env.URL + mediaUpload.url
		}
	} catch (error) {
					console.error('Error downloading or saving the image:', error);
					return {
						error: true,
						message: "Error downloading or saving the image"
		}
	}
}

function convbyteToKB(bytes) {

	return bytes / 1024;

}

module.exports = {
	bufferToFile,

	downloadFileToNetwork
}