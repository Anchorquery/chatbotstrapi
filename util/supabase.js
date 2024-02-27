const { VectorStore } = require("@langchain/core/vectorstores");

const { Document } = require("langchain/document");
const { v4: uuid } = require("uuid");
/**
 * Class for interacting with a Supabase database to store and manage
 * vectors.
 */
module.exports = class SupabaseVectorStoreCustom extends VectorStore {
    _vectorstoreType() {
        return "supabase";
    }
    constructor(embeddings, args) {
        super(embeddings, args);
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tableName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "queryName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "upsertBatchSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 500
        });
        Object.defineProperty(this, "extraData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.client = args.client;
        this.tableName = args.tableName || "documents";
        this.queryName = args.queryName || "match_documents";
        this.filter = args.filter;
        this.upsertBatchSize = args.upsertBatchSize ?? this.upsertBatchSize;
        this.extraData = args.extraData;
    }
    /**
     * Adds documents to the vector store.
     * @param documents The documents to add.
     * @param options Optional parameters for adding the documents.
     * @returns A promise that resolves when the documents have been added.
     */
    async addDocuments(documents, options) {
        
        const texts = documents.map(({ pageContent }) => pageContent);
        return this.addVectors(await this.embeddings.embedDocuments(texts), documents, options);
    }
    /**
     * Adds vectors to the vector store.
     * @param vectors The vectors to add.
     * @param documents The documents associated with the vectors.
     * @param options Optional parameters for adding the vectors.
     * @returns A promise that resolves with the IDs of the added vectors when the vectors have been added.
     */
    async addVectors(vectors, documents, options) {

        if (options.custom == true) {

            if(options.type == 'message'){

                var rows = vectors.map((embedding, idx) => ({
                    content: documents[idx].pageContent,
                    embedding,
                    uuid : options.uuid ? options.uuid: uuid(),
                    datetime : new Date(),
                    sender : options.sender,
                    chat: options.chat,
                    type: 'text',
                    metadata : options.metadata,
                   

                }));

        }else{

            var rows = vectors.map((embedding, idx) => ({
                content: documents[idx].pageContent,
                embedding,
                metadata: documents[idx].metadata,
                created_at: new Date(),
                updated_at: new Date(),
                uuid : options.uuid ? options.uuid: uuid(),
                type: options.type,
                state: true,
                url : documents[idx].metadata.url ? documents[idx].metadata.url : options.url ,
                title: documents[idx].metadata.title ?documents[idx].metadata.title :  options.title,
                client : options.client,
                creator : options.creator,
                created_by_id: options.creator,
                updated_by_id: options.creator,
                grupo_incrustacion: options.grupoIncrustacion,
                
            }));

        }
        } else {
            var rows = vectors.map((embedding, idx) => ({
                content: documents[idx].pageContent,
                embedding,
                metadata: documents[idx].metadata,
                created_at: new Date(),
                updated_at: new Date(),
                state: true,
                uuid : options.uuid ? options.uuid : uuid(),
            }));
        }

       

        // upsert returns 500/502/504 (yes really any of them) if given too many rows/characters
        // ~2000 trips it, but my data is probably smaller than average pageContent and metadata
        let returnedIds = [];
        if(options.type == 'message' ){



            for (let i = 0; i < rows.length; i += this.upsertBatchSize) {

                const chunk = rows.slice(i, i + this.upsertBatchSize).map((row, j) => {
                    if (options?.ids) {
                        return { id: options.ids[i + j], ...row };
                    }
                    return row;
                });
                const res = await this.client.from(this.tableName).upsert({
                    content: chunk[0].content,
                    embedding: chunk[0].embedding,
                    uuid : chunk[0].uuid,
                    datetime : chunk[0].datetime,
                    sender : chunk[0].sender,
                    type: chunk[0].type,
                    metadata : chunk[0].metadata,

                }).select();


    
                if (res.error) {
                    throw new Error(`Error inserting: ${res.error.message} ${res.status} ${res.statusText}`);
                }
                if (res.data) {
                    
                    // busco la sala con  el uuid DE VALOR sala

                    const sala = await strapi.db.query('api::chat.chat').findOne({
                        where : {
                            uuid : options.chat
                        },
                        select : ['id']

                    });

                    await strapi.db.query('api::message.message').update({
                        data : {
                            chat : sala.id
                        },
                        where : {
                            id : res.data[0].id
                        }

                    });
                    returnedIds = returnedIds.concat(res.data.map((row) => row.id));

                }
            }
            

        }
        else{
            for (let i = 0; i < rows.length; i += this.upsertBatchSize) {
                const chunk = rows.slice(i, i + this.upsertBatchSize).map((row, j) => {
                    if (options?.ids) {
                        return { id: options.ids[i + j], ...row };
                    }
                    return row;
                });

                /*const exite = await strapi.db.query('api::document.document').findOne({

                    where : {

                        type : chunk[0].type,
                        url : chunk[0].url,
                        client : chunk[0].client,
                    
                    },

                    select : ['id']
                });*/
                const res = await this.client.from(this.tableName).upsert(chunk).select();
    
    
    
                if (res.error) {
                    throw new Error(`Error inserting: ${res.error.message} ${res.status} ${res.statusText}`);
                }
                if (res.data) {
                    returnedIds = returnedIds.concat(res.data.map((row) => row.id));
                }
            }
        }

        return returnedIds;
    }
    /**
     * Deletes vectors from the vector store.
     * @param params The parameters for deleting vectors.
     * @returns A promise that resolves when the vectors have been deleted.
     */
    async delete(params) {
        const { ids } = params;
        for (const id of ids) {
            await this.client.from(this.tableName).delete().eq("id", id);
        }
    }
    /**
     * Performs a similarity search on the vector store.
     * @param query The query vector.
     * @param k The number of results to return.
     * @param filter Optional filter to apply to the search.
     * @returns A promise that resolves with the search results when the search is complete.
     */
    async similaritySearchVectorWithScore(query, k, filter) {
        if (filter && this.filter) {
            throw new Error("cannot provide both `filter` and `this.filter`");
        }
        const _filter = filter ?? this.filter ?? {};
        const matchDocumentsParams = {
            query_embedding: query,
        };
        let filterFunction;
        if (typeof _filter === "function") {
            filterFunction = (rpcCall) => _filter(rpcCall).limit(k);
        }
        else if (typeof _filter === "object") {
            matchDocumentsParams.filter = _filter;
            matchDocumentsParams.match_count = k;
            filterFunction = (rpcCall) => rpcCall;
        }
        else {
            throw new Error("invalid filter type");
        }
        const rpcCall = this.client.rpc(this.queryName, matchDocumentsParams);
        const { data: searches, error } = await filterFunction(rpcCall);
        if (error) {
            throw new Error(`Error searching for documents: ${error.code} ${error.message} ${error.details}`);
        }
        const result = searches.map((resp) => [
            new Document({
                metadata: resp.metadata,
                pageContent: resp.content,
            }),
            resp.similarity,
        ]);
        return result;
    }
    /**
     * Creates a new SupabaseVectorStore instance from an array of texts.
     * @param texts The texts to create documents from.
     * @param metadatas The metadata for the documents.
     * @param embeddings The embeddings to use.
     * @param dbConfig The configuration for the Supabase database.
     * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
     */
    static async fromTexts(texts, metadatas, embeddings, dbConfig) {
    
        const docs = [];
        for (let i = 0; i < texts.length; i += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
       
        return SupabaseVectorStoreCustom.fromDocuments(docs, embeddings, dbConfig);
    }
    /**
     * Creates a new SupabaseVectorStore instance from an array of documents.
     * @param docs The documents to create the instance from.
     * @param embeddings The embeddings to use.
     * @param dbConfig The configuration for the Supabase database.
     * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
     */
    static async fromDocuments(docs, embeddings, dbConfig) {

        const instance = new this(embeddings, dbConfig);
        await instance.addDocuments(docs, dbConfig.extraData);
        return instance;
    }
    /**
     * Creates a new SupabaseVectorStore instance from an existing index.
     * @param embeddings The embeddings to use.
     * @param dbConfig The configuration for the Supabase database.
     * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
     */
    static async fromExistingIndex(embeddings, dbConfig) {
        const instance = new this(embeddings, dbConfig);
        return instance;
    }
}
