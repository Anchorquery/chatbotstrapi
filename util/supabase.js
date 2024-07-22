const { VectorStore } = require("@langchain/core/vectorstores");
const { Document } = require("langchain/document");
const { v4: uuid } = require("uuid");

module.exports = class SupabaseVectorStoreCustom extends VectorStore {
    _vectorstoreType() {
        return "supabase";
    }

    constructor(embeddings, args) {
        super(embeddings, args);
        this.client = args.client;
        this.tableName = args.tableName || "documents";
        this.queryName = args.queryName || "match_documents";
        this.filter = args.filter;
        this.upsertBatchSize = args.upsertBatchSize ?? 500;
        this.extraData = args.extraData;
    }

    async addDocuments(documents, options) {
        const texts = documents.map(({ pageContent }) => pageContent);
        const vectors = await this.embeddings.embedDocuments(texts);
        return this.addVectors(vectors, documents, options);
    }

    async addVectors(vectors, documents, options = {}) {
        let rows;
        const isCustom = options.custom === true;

        if (isCustom) {
            rows = this.constructCustomRows(vectors, documents, options);
        } else {
            rows = vectors.map((embedding, idx) => ({
                content: documents[idx].pageContent,
                embedding,
                metadata: documents[idx].metadata,
                created_at: new Date(),
                updated_at: new Date(),
                state: true,
                uuid: options.uuid || uuid(),
            }));
        }

        return this.upsertRows(rows, options);
    }

    constructCustomRows(vectors, documents, options) {
        return vectors.map((embedding, idx) => {
            const baseRow = {
                content: documents[idx].pageContent,
                embedding,
                uuid: options.uuid || uuid(),
                created_at: new Date(),
                updated_at: new Date(),
            };

            if (options.type === 'message') {
                return {
                    ...baseRow,
                    datetime: new Date(),
                    sender: options.sender,
                    chat: options.chat,
                    type: 'text',
                    metadata: options.metadata,
                    urlFile: options.file?.url || "",
                    urlType: options.file?.type || "",
                };
            } else {
                return {
                    ...baseRow,
                    metadata: documents[idx].metadata,
                    type: options.type,
                    url: documents[idx].metadata.url || options.url,
                    title: documents[idx].metadata.title || options.title,
                    client: options.client ,
                    creator: options.creator,
                    created_by_id: options.creator,
                    updated_by_id: options.creator,
                    grupo_incrustacion: options.grupoIncrustacion,
                };
            }
        });
    }

    async upsertRows(rows, options) {
        let returnedIds = [];
        for (let i = 0; i < rows.length; i += this.upsertBatchSize) {
            const chunk = rows.slice(i, i + this.upsertBatchSize).map((row, j) => {
                if (options?.ids) {
                    return { id: options.ids[i + j], ...row };
                }
                return row;
            });

            const res = await this.client.from(this.tableName).upsert(chunk).select();

            if (res.error) {
                throw new Error(`Error inserting: ${res.error.message} ${res.status} ${res.statusText}`);
            }

            if (res.data) {
                if (options.type === 'message') {
                    await this.updateChatId(res.data, options.chat);
                }
                returnedIds = returnedIds.concat(res.data.map(row => row.id));
            }
        }
        return returnedIds;
    }

    async updateChatId(data, chatUuid) {
        const chat = await strapi.db.query('api::chat.chat').findOne({
            where: { uuid: chatUuid },
            select: ['id'],
        });

        for (const message of data) {
            await strapi.db.query('api::message.message').update({
                data: { chat: chat.id },
                where: { id: message.id },
            });
        }
    }

    async delete(params) {
        const { ids } = params;
        for (const id of ids) {
            await this.client.from(this.tableName).delete().eq("id", id);
        }
    }

    async similaritySearchVectorWithScore(query, k, filter) {
        if (filter && this.filter) {
            throw new Error("cannot provide both `filter` and `this.filter`");
        }
        const _filter = filter ?? this.filter ?? {};
        const matchDocumentsParams = {
            query_embedding: query,
            filter: _filter,
            match_count: k,
        };

        const rpcCall = this.client.rpc(this.queryName, matchDocumentsParams);
        const { data: searches, error } = await rpcCall;

        if (error) {
            throw new Error(`Error searching for documents: ${error.code} ${error.message} ${error.details}`);
        }

        return searches.map(resp => [
            new Document({ metadata: resp.metadata, pageContent: resp.content }),
            resp.similarity,
        ]);
    }

    static async fromTexts(texts, metadatas, embeddings, dbConfig) {
        const docs = texts.map((text, i) => new Document({
            pageContent: text,
            metadata: Array.isArray(metadatas) ? metadatas[i] : metadatas,
        }));
        return SupabaseVectorStoreCustom.fromDocuments(docs, embeddings, dbConfig);
    }

    static async fromDocuments(docs, embeddings, dbConfig) {
        const instance = new this(embeddings, dbConfig);
        await instance.addDocuments(docs, dbConfig.extraData);
        return instance;
    }

    static async fromExistingIndex(embeddings, dbConfig) {
        return new this(embeddings, dbConfig);
    }
}
