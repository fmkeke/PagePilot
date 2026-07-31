import type { ExecutionResult, HistoricalEvent } from './types'

export type ConversationTurnStatus = 'running' | 'completed' | 'error' | 'stopped'

export interface ConversationRun {
	id: string
	status: ConversationTurnStatus
	result?: Pick<ExecutionResult, 'success' | 'data'>
	history: HistoricalEvent[]
}

export interface ConversationTurn {
	id: string
	userMessage: string
	assistantMessage?: string
	status: ConversationTurnStatus
	createdAt: number
	updatedAt: number
	run: ConversationRun
}

export interface ConversationSession {
	id: string
	title: string
	summary: string
	summarizedTurnCount: number
	turns: ConversationTurn[]
	createdAt: number
	updatedAt: number
}

/**
 * Host-provided persistence for conversations.
 *
 * Core deliberately does not depend on IndexedDB or another storage backend.
 */
export interface ConversationStore {
	get(id: string): Promise<ConversationSession | undefined>
	getLatest(): Promise<ConversationSession | undefined>
	save(conversation: ConversationSession): Promise<void>
	delete(id: string): Promise<void>
}

export interface ConversationContextOptions {
	recentTurnLimit?: number
	summaryMaxChars?: number
}

const DEFAULT_RECENT_TURN_LIMIT = 6
const DEFAULT_SUMMARY_MAX_CHARS = 4_000

export class MemoryConversationStore implements ConversationStore {
	#conversations = new Map<string, ConversationSession>()

	async get(id: string): Promise<ConversationSession | undefined> {
		return cloneConversation(this.#conversations.get(id))
	}

	async getLatest(): Promise<ConversationSession | undefined> {
		const latest = Array.from(this.#conversations.values()).sort(
			(a, b) => b.updatedAt - a.updatedAt
		)[0]
		return cloneConversation(latest)
	}

	async save(conversation: ConversationSession): Promise<void> {
		this.#conversations.set(conversation.id, cloneConversation(conversation)!)
	}

	async delete(id: string): Promise<void> {
		this.#conversations.delete(id)
	}
}

export function createConversation(id: string, now = Date.now()): ConversationSession {
	return {
		id,
		title: '',
		summary: '',
		summarizedTurnCount: 0,
		turns: [],
		createdAt: now,
		updatedAt: now,
	}
}

/**
 * Build compact cross-turn context. Old turns are represented by an extractive
 * rolling summary while recent turns remain verbatim for reference resolution.
 */
export function buildConversationContext(
	conversation: ConversationSession,
	options: ConversationContextOptions = {}
): string {
	const recentTurnLimit = Math.max(0, options.recentTurnLimit ?? DEFAULT_RECENT_TURN_LIMIT)
	const recentTurns = recentTurnLimit === 0 ? [] : conversation.turns.slice(-recentTurnLimit)

	if (!conversation.summary && recentTurns.length === 0) return ''

	let context = '<conversation_context>\n'
	if (conversation.summary) {
		context += `<summary>\n${conversation.summary}\n</summary>\n`
	}
	if (recentTurns.length > 0) {
		context += '<recent_turns>\n'
		for (const turn of recentTurns) {
			context += '<turn>\n'
			context += `<user>${turn.userMessage}</user>\n`
			if (turn.assistantMessage) {
				context += `<assistant>${turn.assistantMessage}</assistant>\n`
			}
			context += '</turn>\n'
		}
		context += '</recent_turns>\n'
	}
	context += '</conversation_context>\n\n'
	return context
}

/**
 * Move turns older than the recent window into an extractive rolling summary.
 * Full turns remain in storage/UI; summarizedTurnCount only controls LLM context.
 */
export function compactConversation(
	conversation: ConversationSession,
	options: ConversationContextOptions = {}
): void {
	const recentTurnLimit = Math.max(0, options.recentTurnLimit ?? DEFAULT_RECENT_TURN_LIMIT)
	const summaryMaxChars = Math.max(1, options.summaryMaxChars ?? DEFAULT_SUMMARY_MAX_CHARS)
	const targetCount = Math.max(0, conversation.turns.length - recentTurnLimit)
	if (targetCount <= conversation.summarizedTurnCount) return

	const additions = conversation.turns
		.slice(conversation.summarizedTurnCount, targetCount)
		.map((turn) => {
			const assistant = turn.assistantMessage ? `\nAssistant: ${turn.assistantMessage}` : ''
			return `User: ${turn.userMessage}${assistant}`
		})
		.join('\n')

	conversation.summary = [conversation.summary, additions].filter(Boolean).join('\n')
	if (conversation.summary.length > summaryMaxChars) {
		conversation.summary =
			'[Earlier conversation omitted]\n' + conversation.summary.slice(-summaryMaxChars)
	}
	conversation.summarizedTurnCount = targetCount
}

export function cloneConversation(
	conversation: ConversationSession | undefined
): ConversationSession | undefined {
	return conversation ? structuredClone(conversation) : undefined
}
