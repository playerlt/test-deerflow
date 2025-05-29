// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { nanoid } from "nanoid";
import { toast } from "sonner";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { chatStream, generatePodcast, getFinalPaper, type FinalPaperResponse } from "../api";
import type { Message } from "../messages";
import { mergeMessage } from "../messages";
import { parseJSON } from "../utils";

import { getChatStreamSettings } from "./settings-store";

const THREAD_ID = nanoid();

export const useStore = create<{
  responding: boolean;
  threadId: string | undefined;
  messageIds: string[];
  messages: Map<string, Message>;
  researchIds: string[];
  researchPlanIds: Map<string, string>;
  researchReportIds: Map<string, string>;
  researchActivityIds: Map<string, string[]>;
  ongoingResearchId: string | null;
  openResearchId: string | null;

  // Paper writing state
  paperSections: string[];
  paperOutlineId: string | null;
  completedPaperId: string | null;
  finalPaper: FinalPaperResponse | null;
  finalPaperLoading: boolean;
  finalPaperError: string | null;

  appendMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  updateMessages: (messages: Message[]) => void;
  openResearch: (researchId: string | null) => void;
  closeResearch: () => void;
  setOngoingResearch: (researchId: string | null) => void;
  
  // Paper writing methods
  addPaperSection: (sectionContent: string) => void;
  setPaperOutline: (outlineId: string) => void;
  setCompletedPaper: (paperId: string) => void;
  resetPaperState: () => void;
  
  // Final paper methods
  fetchFinalPaper: (threadId: string) => Promise<void>;
  clearFinalPaper: () => void;
}>((set, get) => ({
  responding: false,
  threadId: THREAD_ID,
  messageIds: [],
  messages: new Map<string, Message>(),
  researchIds: [],
  researchPlanIds: new Map<string, string>(),
  researchReportIds: new Map<string, string>(),
  researchActivityIds: new Map<string, string[]>(),
  ongoingResearchId: null,
  openResearchId: null,
  
  // Paper writing state
  paperSections: [],
  paperOutlineId: null,
  completedPaperId: null,
  finalPaper: null,
  finalPaperLoading: false,
  finalPaperError: null,

  appendMessage(message: Message) {
    set((state) => ({
      messageIds: [...state.messageIds, message.id],
      messages: new Map(state.messages).set(message.id, message),
    }));
  },
  updateMessage(message: Message) {
    set((state) => ({
      messages: new Map(state.messages).set(message.id, message),
    }));
  },
  updateMessages(messages: Message[]) {
    set((state) => {
      const newMessages = new Map(state.messages);
      messages.forEach((m) => newMessages.set(m.id, m));
      return { messages: newMessages };
    });
  },
  openResearch(researchId: string | null) {
    set({ openResearchId: researchId });
  },
  closeResearch() {
    set({ openResearchId: null });
  },
  setOngoingResearch(researchId: string | null) {
    set({ ongoingResearchId: researchId });
  },
  
  // Paper writing methods
  addPaperSection(sectionContent: string) {
    set((state) => ({
      paperSections: [...state.paperSections, sectionContent],
    }));
  },
  setPaperOutline(outlineId: string) {
    console.log("🔧 Setting paper outline ID:", outlineId);
    set({ paperOutlineId: outlineId });
  },
  setCompletedPaper(paperId: string) {
    set({ completedPaperId: paperId });
  },
  resetPaperState() {
    set({
      paperSections: [],
      completedPaperId: null,
    });
  },
  
  // Final paper methods
  async fetchFinalPaper(threadId: string) {
    console.log("🔄 fetchFinalPaper called for thread:", threadId);
    set({ finalPaperLoading: true, finalPaperError: null });
    try {
      console.log("📡 Calling getFinalPaper API...");
      const finalPaper = await getFinalPaper(threadId);
      console.log("✅ getFinalPaper API response:", finalPaper);
      console.log("📄 Final paper content length:", finalPaper.final_paper?.length || 0);
      console.log("📄 Final paper preview:", finalPaper.final_paper?.substring(0, 200) + "...");
      set({ finalPaper, finalPaperLoading: false });
      console.log("✅ Final paper stored in state successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch final paper';
      console.error("❌ Error fetching final paper:", error);
      set({ finalPaperError: errorMessage, finalPaperLoading: false });
    }
  },
  clearFinalPaper() {
    set({ finalPaper: null, finalPaperError: null, finalPaperLoading: false });
  },
}));

export async function sendMessage(
  content?: string,
  {
    interruptFeedback,
  }: {
    interruptFeedback?: string;
  } = {},
  options: { abortSignal?: AbortSignal } = {},
) {
  if (content != null) {
    appendMessage({
      id: nanoid(),
      threadId: THREAD_ID,
      role: "user",
      content: content,
      contentChunks: [content],
    });
  }

  const settings = getChatStreamSettings();
  const stream = chatStream(
    content ?? "[REPLAY]",
    {
      thread_id: THREAD_ID,
      interrupt_feedback: interruptFeedback,
      auto_accepted_plan: settings.autoAcceptedPlan,
      enable_background_investigation:
        settings.enableBackgroundInvestigation ?? true,
      max_plan_iterations: settings.maxPlanIterations,
      max_step_num: settings.maxStepNum,
      max_search_results: settings.maxSearchResults,
      mcp_settings: settings.mcpSettings,
    },
    options,
  );

  setResponding(true);
  let messageId: string | undefined;
  try {
    for await (const event of stream) {
      const { type, data } = event;
      messageId = data.id;
      let message: Message | undefined;
      if (type === "tool_call_result") {
        message = findMessageByToolCallId(data.tool_call_id);
      } else if (!existsMessage(messageId)) {
        message = {
          id: messageId,
          threadId: data.thread_id,
          agent: data.agent,
          role: data.role,
          content: "",
          contentChunks: [],
          isStreaming: true,
          interruptFeedback,
        };
        appendMessage(message);
      }
      message ??= getMessage(messageId);
      if (message) {
        message = mergeMessage(message, event);
        updateMessage(message);
      }
    }
  } catch {
    toast("An error occurred while generating the response. Please try again.");
    // Update message status.
    // TODO: const isAborted = (error as Error).name === "AbortError";
    if (messageId != null) {
      const message = getMessage(messageId);
      if (message?.isStreaming) {
        message.isStreaming = false;
        useStore.getState().updateMessage(message);
      }
    }
    useStore.getState().setOngoingResearch(null);
  } finally {
    setResponding(false);
  }
}

function setResponding(value: boolean) {
  useStore.setState({ responding: value });
}

function existsMessage(id: string) {
  return useStore.getState().messageIds.includes(id);
}

function getMessage(id: string) {
  return useStore.getState().messages.get(id);
}

function findMessageByToolCallId(toolCallId: string) {
  return Array.from(useStore.getState().messages.values())
    .reverse()
    .find((message) => {
      if (message.toolCalls) {
        return message.toolCalls.some((toolCall) => toolCall.id === toolCallId);
      }
      return false;
    });
}

function appendMessage(message: Message) {
  // Debug all messages
  console.log("📨 appendMessage called:", {
    id: message.id,
    agent: message.agent,
    role: message.role,
    isStreaming: message.isStreaming,
    contentLength: message.content?.length,
    contentPreview: message.content?.substring(0, 100)
  });

  if (
    message.agent === "coder" ||
    message.agent === "thinking" ||
    message.agent === "reporter" ||
    message.agent === "researcher"
  ) {
    if (!getOngoingResearchId()) {
      const id = message.id;
      appendResearch(id);
      openResearch(id);
    }
    appendResearchActivity(message);
  }
  
  // Handle paper writing workflow
  if (message.agent === "outline_writer" && !message.isStreaming) {
    console.log("📋 Outline writer message detected (append), setting outline ID:", message.id);
    console.log("📋 Outline content preview:", message.content?.substring(0, 200));
    useStore.getState().setPaperOutline(message.id);
    useStore.getState().resetPaperState(); // Reset sections when new outline is created
  }
  
  if (message.agent === "paper_writer" && !message.isStreaming) {
    // Extract section content from paper writer message
    console.log("📝 Paper writer message detected (append):", {
      agent: message.agent,
      isStreaming: message.isStreaming,
      contentLength: message.content?.length,
      contentPreview: message.content?.substring(0, 100)
    });
    
    // Try to parse as JSON first
    const sectionData = parseJSON(message.content ?? "", {}) as { section_content?: string };
    
    if (sectionData.section_content) {
      // JSON format with section_content field
      console.log("✅ Adding section from JSON format (append)");
      useStore.getState().addPaperSection(sectionData.section_content);
    } else if (message.content?.trim()) {
      // Plain text format - use the entire content as section content
      console.log("✅ Adding section from plain text format (append)");
      useStore.getState().addPaperSection(message.content);
    }
    
    console.log("📚 Total sections now (append):", useStore.getState().paperSections.length);
    
    // Check if this might be the last paper_writer message and auto-fetch final paper
    checkAndFetchFinalPaper(message.threadId);
  }
  
  // Handle reporter in normal research workflow (not paper writing)
  if (message.agent === "reporter" && !message.isStreaming) {
    // Check if this is a paper writing workflow
    const isPaperWritingWorkflow = Array.from(useStore.getState().messages.values())
      .some(msg => msg.agent === "paper_writer" || msg.agent === "outline_writer");
    
    if (!isPaperWritingWorkflow) {
      // This is a normal research workflow, handle normally
      console.log("📄 Reporter message in normal research workflow (append)");
    }
    // Note: In paper writing workflow, reporter doesn't send messages to frontend
    // so we handle final paper fetching in paper_writer completion instead
  }
  
  useStore.getState().appendMessage(message);
}

function updateMessage(message: Message) {
  // Debug all message updates
  console.log("🔄 updateMessage called:", {
    id: message.id,
    agent: message.agent,
    role: message.role,
    isStreaming: message.isStreaming,
    contentLength: message.content?.length,
    contentPreview: message.content?.substring(0, 100)
  });

  // Check if this is a paper writing workflow by looking for paper_writer messages
  const isPaperWritingWorkflow = Array.from(useStore.getState().messages.values())
    .some(msg => msg.agent === "paper_writer" || msg.agent === "outline_writer");

  if (
    getOngoingResearchId() &&
    message.agent === "reporter" &&
    !message.isStreaming &&
    !isPaperWritingWorkflow  // Don't close research for paper writing workflow
  ) {
    useStore.getState().setOngoingResearch(null);
  }
  
  // Handle paper writing workflow updates
  if (message.agent === "outline_writer" && !message.isStreaming) {
    console.log("📋 Outline writer message detected (update), setting outline ID:", message.id);
    console.log("📋 Outline content preview:", message.content?.substring(0, 200));
    useStore.getState().setPaperOutline(message.id);
    useStore.getState().resetPaperState(); // Reset sections when new outline is created
  }
  
  if (message.agent === "paper_writer" && !message.isStreaming) {
    // Extract section content from paper writer message
    console.log("📝 Paper writer message detected (update):", {
      agent: message.agent,
      isStreaming: message.isStreaming,
      contentLength: message.content?.length,
      contentPreview: message.content?.substring(0, 100)
    });
    
    // Try to parse as JSON first
    const sectionData = parseJSON(message.content ?? "", {}) as { section_content?: string };
    
    if (sectionData.section_content) {
      // JSON format with section_content field
      console.log("✅ Adding section from JSON format (update)");
      useStore.getState().addPaperSection(sectionData.section_content);
    } else if (message.content?.trim()) {
      // Plain text format - use the entire content as section content
      console.log("✅ Adding section from plain text format (update)");
      useStore.getState().addPaperSection(message.content);
    }
    
    console.log("📚 Total sections now (update):", useStore.getState().paperSections.length);
    
    // Check if this might be the last paper_writer message and auto-fetch final paper
    checkAndFetchFinalPaper(message.threadId);
  }
  
  useStore.getState().updateMessage(message);
}

// Helper function to check if all paper writers are done and fetch final paper
function checkAndFetchFinalPaper(threadId: string) {
  // Wait a bit to ensure all messages have been processed
  setTimeout(() => {
    const state = useStore.getState();
    const allMessages = Array.from(state.messages.values());
    
    // Check if this is a paper writing workflow
    const isPaperWritingWorkflow = allMessages.some(msg => 
      msg.agent === "paper_writer" || msg.agent === "outline_writer"
    );
    
    if (!isPaperWritingWorkflow) {
      console.log("🚫 Not a paper writing workflow, skipping final paper fetch");
      return;
    }
    
    // Check if there are any paper_writer messages at all
    const hasPaperWriters = allMessages.some(msg => msg.agent === "paper_writer");
    
    if (!hasPaperWriters) {
      console.log("🚫 No paper_writer messages yet, skipping final paper fetch");
      return;
    }
    
    // Get the outline to estimate expected sections
    const outlineMessage = allMessages.find(msg => msg.agent === "outline_writer" && !msg.isStreaming);
    let expectedSections = 3; // Default minimum sections
    
    if (outlineMessage?.content) {
      // Try to estimate expected sections from outline
      const outlineContent = outlineMessage.content.toLowerCase();
      
      // Count section indicators in the outline
      const sectionIndicators = [
        /##\s+/g,  // Markdown h2 headers
        /\d+\.\s+/g,  // Numbered sections
        /section\s+\d+/g,  // "Section X" patterns
        /第\s*[一二三四五六七八九十\d]+\s*[章节部分]/g,  // Chinese section patterns
      ];
      
      let maxSectionCount = 0;
      sectionIndicators.forEach(pattern => {
        const matches = outlineContent.match(pattern);
        if (matches) {
          maxSectionCount = Math.max(maxSectionCount, matches.length);
        }
      });
      
      // Use the detected section count, but ensure minimum of 2 and maximum of 8
      if (maxSectionCount > 0) {
        expectedSections = Math.min(Math.max(maxSectionCount, 2), 8);
      }
      
      console.log("📋 Outline analysis:", {
        outlineLength: outlineContent.length,
        detectedSections: maxSectionCount,
        expectedSections
      });
    }
    
    // Check if there are any streaming paper_writer messages
    const streamingPaperWriters = allMessages.filter(msg => 
      msg.agent === "paper_writer" && msg.isStreaming
    );
    
    // Check if there are any streaming messages at all (indicating workflow is still active)
    const anyStreamingMessages = allMessages.some(msg => msg.isStreaming);
    
    // Count completed paper writers
    const completedPaperWriters = allMessages.filter(msg => 
      msg.agent === "paper_writer" && !msg.isStreaming
    );
    
    console.log("🔍 Checking paper writing completion:", {
      isPaperWritingWorkflow,
      hasPaperWriters,
      expectedSections,
      completedPaperWriters: completedPaperWriters.length,
      streamingPaperWriters: streamingPaperWriters.length,
      anyStreamingMessages,
      totalSections: state.paperSections.length,
      finalPaper: !!state.finalPaper
    });
    
    // Enhanced conditions for fetching final paper:
    // 1. Has paper writers
    // 2. No paper writers are streaming
    // 3. No messages are streaming (workflow is idle)
    // 4. Completed paper writers >= expected sections (all sections done)
    // 5. Don't already have a final paper
    const shouldFetch = (
      hasPaperWriters && 
      streamingPaperWriters.length === 0 && 
      !anyStreamingMessages && 
      completedPaperWriters.length >= expectedSections &&
      !state.finalPaper
    );
    
    if (shouldFetch) {
      console.log("📄 All expected paper sections completed, automatically fetching final paper for thread:", threadId);
      console.log(`   ✅ Completed ${completedPaperWriters.length}/${expectedSections} expected sections`);
      state.fetchFinalPaper(threadId);
    } else {
      console.log("⏳ Not ready to fetch final paper yet:", {
        needMoreSections: completedPaperWriters.length < expectedSections,
        stillStreaming: streamingPaperWriters.length > 0 || anyStreamingMessages,
        alreadyHasFinalPaper: !!state.finalPaper
      });
    }
  }, 1000); // Wait 1 second to ensure all messages are processed
}

function getOngoingResearchId() {
  return useStore.getState().ongoingResearchId;
}

function appendResearch(researchId: string) {
  let planMessage: Message | undefined;
  const reversedMessageIds = [...useStore.getState().messageIds].reverse();
  for (const messageId of reversedMessageIds) {
    const message = getMessage(messageId);
    if (message?.agent === "planner") {
      planMessage = message;
      break;
    }
  }
  const messageIds = [researchId];
  messageIds.unshift(planMessage!.id);
  useStore.setState({
    ongoingResearchId: researchId,
    researchIds: [...useStore.getState().researchIds, researchId],
    researchPlanIds: new Map(useStore.getState().researchPlanIds).set(
      researchId,
      planMessage!.id,
    ),
    researchActivityIds: new Map(useStore.getState().researchActivityIds).set(
      researchId,
      messageIds,
    ),
  });
}

function appendResearchActivity(message: Message) {
  const researchId = getOngoingResearchId();
  if (researchId) {
    const researchActivityIds = useStore.getState().researchActivityIds;
    const current = researchActivityIds.get(researchId)!;
    if (!current.includes(message.id)) {
      useStore.setState({
        researchActivityIds: new Map(researchActivityIds).set(researchId, [
          ...current,
          message.id,
        ]),
      });
    }
    if (message.agent === "reporter") {
      useStore.setState({
        researchReportIds: new Map(useStore.getState().researchReportIds).set(
          researchId,
          message.id,
        ),
      });
    }
  }
}

export function openResearch(researchId: string | null) {
  useStore.getState().openResearch(researchId);
}

export function closeResearch() {
  useStore.getState().closeResearch();
}

export async function listenToPodcast(researchId: string) {
  const planMessageId = useStore.getState().researchPlanIds.get(researchId);
  const reportMessageId = useStore.getState().researchReportIds.get(researchId);
  if (planMessageId && reportMessageId) {
    const planMessage = getMessage(planMessageId)!;
    const title = parseJSON(planMessage.content, { title: "Untitled" }).title;
    const reportMessage = getMessage(reportMessageId);
    if (reportMessage?.content) {
      appendMessage({
        id: nanoid(),
        threadId: THREAD_ID,
        role: "user",
        content: "Please generate a podcast for the above research.",
        contentChunks: [],
      });
      const podCastMessageId = nanoid();
      const podcastObject = { title, researchId };
      const podcastMessage: Message = {
        id: podCastMessageId,
        threadId: THREAD_ID,
        role: "assistant",
        agent: "podcast",
        content: JSON.stringify(podcastObject),
        contentChunks: [],
        isStreaming: true,
      };
      appendMessage(podcastMessage);
      // Generating podcast...
      let audioUrl: string | undefined;
      try {
        audioUrl = await generatePodcast(reportMessage.content);
      } catch (e) {
        console.error(e);
        useStore.setState((state) => ({
          messages: new Map(useStore.getState().messages).set(
            podCastMessageId,
            {
              ...state.messages.get(podCastMessageId)!,
              content: JSON.stringify({
                ...podcastObject,
                error: e instanceof Error ? e.message : "Unknown error",
              }),
              isStreaming: false,
            },
          ),
        }));
        toast("An error occurred while generating podcast. Please try again.");
        return;
      }
      useStore.setState((state) => ({
        messages: new Map(useStore.getState().messages).set(podCastMessageId, {
          ...state.messages.get(podCastMessageId)!,
          content: JSON.stringify({ ...podcastObject, audioUrl }),
          isStreaming: false,
        }),
      }));
    }
  }
}

export function useResearchMessage(researchId: string) {
  return useStore(
    useShallow((state) => {
      const messageId = state.researchPlanIds.get(researchId);
      return messageId ? state.messages.get(messageId) : undefined;
    }),
  );
}

export function useMessage(messageId: string | null | undefined) {
  return useStore(
    useShallow((state) =>
      messageId ? state.messages.get(messageId) : undefined,
    ),
  );
}

export function useMessageIds() {
  return useStore(useShallow((state) => state.messageIds));
}

export function useLastInterruptMessage() {
  return useStore(
    useShallow((state) => {
      if (state.messageIds.length >= 2) {
        const lastMessage = state.messages.get(
          state.messageIds[state.messageIds.length - 1]!,
        );
        return lastMessage?.finishReason === "interrupt" ? lastMessage : null;
      }
      return null;
    }),
  );
}

export function useLastFeedbackMessageId() {
  const waitingForFeedbackMessageId = useStore(
    useShallow((state) => {
      if (state.messageIds.length >= 2) {
        const lastMessage = state.messages.get(
          state.messageIds[state.messageIds.length - 1]!,
        );
        if (lastMessage && lastMessage.finishReason === "interrupt") {
          return state.messageIds[state.messageIds.length - 2];
        }
      }
      return null;
    }),
  );
  return waitingForFeedbackMessageId;
}

export function useToolCalls() {
  return useStore(
    useShallow((state) => {
      return state.messageIds
        ?.map((id) => getMessage(id)?.toolCalls)
        .filter((toolCalls) => toolCalls != null)
        .flat();
    }),
  );
}

// Paper writing hooks
export function usePaperSections() {
  return useStore(useShallow((state) => state.paperSections));
}

export function usePaperOutlineId() {
  const outlineId = useStore(useShallow((state) => state.paperOutlineId));
  console.log("🔍 usePaperOutlineId called, returning:", outlineId);
  return outlineId;
}

export function useCompletedPaperId() {
  return useStore(useShallow((state) => state.completedPaperId));
}

export function usePaperOutlineMessage() {
  const outlineId = usePaperOutlineId();
  return useMessage(outlineId);
}

// Final paper hooks
export function useFinalPaper() {
  return useStore(useShallow((state) => state.finalPaper));
}

export function useFinalPaperLoading() {
  return useStore(useShallow((state) => state.finalPaperLoading));
}

export function useFinalPaperError() {
  return useStore(useShallow((state) => state.finalPaperError));
}
