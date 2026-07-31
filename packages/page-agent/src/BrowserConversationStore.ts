import type { ConversationSession, ConversationStore } from '@page-agent/core'

const DB_NAME = 'page-agent-conversations'
const DB_VERSION = 1
const STORE_NAME = 'conversations'

/** IndexedDB conversation persistence for the built-in browser Panel. */
export class BrowserConversationStore implements ConversationStore {
	#dbPromise: Promise<IDBDatabase> | null = null

	async get(id: string): Promise<ConversationSession | undefined> {
		const db = await this.#getDB()
		return requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id))
	}

	async getLatest(): Promise<ConversationSession | undefined> {
		const db = await this.#getDB()
		const index = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('by-updated')
		return requestToPromise(index.openCursor(null, 'prev')).then((cursor) => cursor?.value)
	}

	async save(conversation: ConversationSession): Promise<void> {
		const db = await this.#getDB()
		const transaction = db.transaction(STORE_NAME, 'readwrite')
		transaction.objectStore(STORE_NAME).put(conversation)
		await transactionDone(transaction)
	}

	async delete(id: string): Promise<void> {
		const db = await this.#getDB()
		const transaction = db.transaction(STORE_NAME, 'readwrite')
		transaction.objectStore(STORE_NAME).delete(id)
		await transactionDone(transaction)
	}

	#getDB(): Promise<IDBDatabase> {
		if (!this.#dbPromise) {
			this.#dbPromise = new Promise((resolve, reject) => {
				const request = indexedDB.open(DB_NAME, DB_VERSION)
				request.onupgradeneeded = () => {
					if (request.result.objectStoreNames.contains(STORE_NAME)) return
					const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
					store.createIndex('by-updated', 'updatedAt')
				}
				request.onsuccess = () => resolve(request.result)
				request.onerror = () =>
					reject(request.error ?? new Error('Failed to open the conversation database.'))
			})
		}
		return this.#dbPromise
	}
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () =>
			reject(request.error ?? new Error('IndexedDB conversation request failed.'))
	})
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB conversation transaction failed.'))
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB conversation transaction was aborted.'))
	})
}
