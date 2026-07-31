/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, MemoryConversationStore, PageAgentCore } from '@page-agent/core'
import { PageController, type PageControllerConfig } from '@page-agent/page-controller'
import { Panel, type PanelConfig } from '@page-agent/ui'

import { BrowserConversationStore } from './BrowserConversationStore'

export * from '@page-agent/core'
export { BrowserConversationStore } from './BrowserConversationStore'

export type PageAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>

export class PageAgent extends PageAgentCore {
	panel: Panel

	constructor(config: PageAgentConfig) {
		const pageController = new PageController({
			...config,
			enableMask: config.enableMask ?? true,
		})

		const conversationStore =
			config.conversationStore ??
			(typeof indexedDB === 'undefined'
				? new MemoryConversationStore()
				: new BrowserConversationStore())

		super({ ...config, pageController, conversationStore })

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
		})
	}
}
