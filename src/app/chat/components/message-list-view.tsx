// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { LoadingOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { Download, Headphones, FileText, Edit3 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { LoadingAnimation } from "~/components/deer-flow/loading-animation";
import { Markdown } from "~/components/deer-flow/markdown";
import { RainbowText } from "~/components/deer-flow/rainbow-text";
import { RollingText } from "~/components/deer-flow/rolling-text";
import {
  ScrollContainer,
  type ScrollContainerRef,
} from "~/components/deer-flow/scroll-container";
import { Tooltip } from "~/components/deer-flow/tooltip";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { Message, Option } from "~/core/messages";
import {
  closeResearch,
  openResearch,
  useLastFeedbackMessageId,
  useLastInterruptMessage,
  useMessage,
  useMessageIds,
  useResearchMessage,
  useStore,
} from "~/core/store";
import { parseJSON } from "~/core/utils";
import { cn } from "~/lib/utils";

export function MessageListView({
  className,
  onFeedback,
  onSendMessage,
}: {
  className?: string;
  onFeedback?: (feedback: { option: Option }) => void;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string },
  ) => void;
}) {
  const scrollContainerRef = useRef<ScrollContainerRef>(null);
  const messageIds = useMessageIds();
  const interruptMessage = useLastInterruptMessage();
  const waitingForFeedbackMessageId = useLastFeedbackMessageId();
  const responding = useStore((state) => state.responding);
  const noOngoingResearch = useStore(
    (state) => state.ongoingResearchId === null,
  );
  const ongoingResearchIsOpen = useStore(
    (state) => state.ongoingResearchId === state.openResearchId,
  );
  
  const handleToggleResearch = useCallback(() => {
    // Fix the issue where auto-scrolling to the bottom
    // occasionally fails when toggling research.
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollToBottom();
      }
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <ScrollContainer
      className={cn("flex h-full w-full flex-col overflow-hidden", className)}
      scrollShadowColor="var(--app-background)"
      autoScrollToBottom
      ref={scrollContainerRef}
    >
      <ul className="flex flex-col">
        {messageIds.map((messageId) => (
          <MessageListItem
            key={messageId}
            messageId={messageId}
            waitForFeedback={waitingForFeedbackMessageId === messageId}
            interruptMessage={interruptMessage}
            onFeedback={onFeedback}
            onSendMessage={onSendMessage}
            onToggleResearch={handleToggleResearch}
          />
        ))}
        <div className="flex h-8 w-full shrink-0"></div>
      </ul>
      {responding && (noOngoingResearch || !ongoingResearchIsOpen) && (
        <LoadingAnimation className="ml-4" />
      )}
    </ScrollContainer>
  );
}

function MessageListItem({
  className,
  messageId,
  waitForFeedback,
  interruptMessage,
  onFeedback,
  onSendMessage,
  onToggleResearch,
}: {
  className?: string;
  messageId: string;
  waitForFeedback?: boolean;
  onFeedback?: (feedback: { option: Option }) => void;
  interruptMessage?: Message | null;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string },
  ) => void;
  onToggleResearch?: () => void;
}) {
  const message = useMessage(messageId);
  const researchIds = useStore((state) => state.researchIds);
  const startOfResearch = useMemo(() => {
    return researchIds.includes(messageId);
  }, [researchIds, messageId]);
  if (message) {
    if (
      message.role === "user" ||
      message.agent === "coordinator" ||
      message.agent === "planner" ||
      message.agent === "podcast" ||
      message.agent === "outline_writer" ||
      message.agent === "paper_writer" ||
      message.agent === "reporter" ||
      message.agent === "final_paper" ||
      startOfResearch
    ) {
      let content: React.ReactNode;
      if (message.agent === "planner") {
        content = (
          <div className="w-full px-4">
            <PlanCard
              message={message}
              waitForFeedback={waitForFeedback}
              interruptMessage={interruptMessage}
              onFeedback={onFeedback}
              onSendMessage={onSendMessage}
            />
          </div>
        );
      } else if (message.agent === "podcast") {
        content = (
          <div className="w-full px-4">
            <PodcastCard message={message} />
          </div>
        );
      } else if (message.agent === "outline_writer") {
        content = (
          <div className="w-full px-4">
            <OutlineCard
              message={message}
              waitForFeedback={waitForFeedback}
              interruptMessage={interruptMessage}
              onFeedback={onFeedback}
              onSendMessage={onSendMessage}
            />
          </div>
        );
      } else if (message.agent === "paper_writer") {
        content = (
          <div className="w-full px-4">
            <PaperWritingCard message={message} />
          </div>
        );
      } else if (message.agent === "final_paper") {
        content = (
          <div className="w-full px-4">
            <FinalPaperCard message={message} />
          </div>
        );
      } else if (message.agent === "reporter") {
        content = (
          <div className="w-full px-4">
            <ReporterCard message={message} />
          </div>
        );
      } else if (startOfResearch) {
        content = (
          <div className="w-full px-4">
            <ResearchCard
              researchId={message.id}
              onToggleResearch={onToggleResearch}
            />
          </div>
        );
      } else {
        content = message.content ? (
          <div
            className={cn(
              "flex w-full px-4",
              message.role === "user" && "justify-end",
              className,
            )}
          >
            <MessageBubble message={message}>
              <div className="flex w-full flex-col">
                <Markdown>{message?.content}</Markdown>
              </div>
            </MessageBubble>
          </div>
        ) : null;
      }
      if (content) {
        return (
          <motion.li
            className="mt-10"
            key={messageId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ transition: "all 0.2s ease-out" }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
          >
            {content}
          </motion.li>
        );
      }
    }
    return null;
  }
}

function MessageBubble({
  className,
  message,
  children,
}: {
  className?: string;
  message: Message;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        `flex w-fit max-w-[85%] flex-col rounded-2xl px-4 py-3 shadow`,
        message.role === "user" &&
          "text-primary-foreground bg-brand rounded-ee-none",
        message.role === "assistant" && "bg-card rounded-es-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ResearchCard({
  className,
  researchId,
  onToggleResearch,
}: {
  className?: string;
  researchId: string;
  onToggleResearch?: () => void;
}) {
  const reportId = useStore((state) => state.researchReportIds.get(researchId));
  const hasReport = reportId !== undefined;
  const reportGenerating = useStore(
    (state) => hasReport && state.messages.get(reportId)!.isStreaming,
  );
  const openResearchId = useStore((state) => state.openResearchId);
  const state = useMemo(() => {
    if (hasReport) {
      return reportGenerating ? "Generating report..." : "Report generated";
    }
    return "Researching...";
  }, [hasReport, reportGenerating]);
  const msg = useResearchMessage(researchId);
  const title = useMemo(() => {
    if (msg) {
      return parseJSON(msg.content ?? "", { title: "" }).title;
    }
    return undefined;
  }, [msg]);
  const handleOpen = useCallback(() => {
    if (openResearchId === researchId) {
      closeResearch();
    } else {
      openResearch(researchId);
    }
    onToggleResearch?.();
  }, [openResearchId, researchId, onToggleResearch]);
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>
          <RainbowText animated={state !== "Report generated"}>
            {title !== undefined && title !== "" ? title : "Deep Research"}
          </RainbowText>
        </CardTitle>
      </CardHeader>
      <CardFooter>
        <div className="flex w-full">
          <RollingText className="text-muted-foreground flex-grow text-sm">
            {state}
          </RollingText>
          <Button
            variant={!openResearchId ? "default" : "outline"}
            onClick={handleOpen}
          >
            {researchId !== openResearchId ? "Open" : "Close"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

const GREETINGS = ["Cool", "Sounds great", "Looks good", "Great", "Awesome"];
function PlanCard({
  className,
  message,
  interruptMessage,
  onFeedback,
  waitForFeedback,
  onSendMessage,
}: {
  className?: string;
  message: Message;
  interruptMessage?: Message | null;
  onFeedback?: (feedback: { option: Option }) => void;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string },
  ) => void;
  waitForFeedback?: boolean;
}) {
  const plan = useMemo<{
    title?: string;
    thought?: string;
    steps?: { title?: string; description?: string }[];
  }>(() => {
    return parseJSON(message.content ?? "", {});
  }, [message.content]);
  const handleAccept = useCallback(async () => {
    if (onSendMessage) {
      onSendMessage(
        `${GREETINGS[Math.floor(Math.random() * GREETINGS.length)]}! ${Math.random() > 0.5 ? "Let's get started." : "Let's start."}`,
        {
          interruptFeedback: "accepted",
        },
      );
    }
  }, [onSendMessage]);


  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>
          <Markdown animated>
            {`### ${
              plan.title !== undefined && plan.title !== ""
                ? plan.title
                : "Deep Research"
            }`}
          </Markdown>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Markdown className="opacity-80" animated>
          {plan.thought}
        </Markdown>
        {plan.steps && (
          <ul className="my-2 flex list-decimal flex-col gap-4 border-l-[2px] pl-8">
            {plan.steps.map((step, i) => (
              <li key={`step-${i}`}>
                <h3 className="mb text-lg font-medium">
                  <Markdown animated>{step.title}</Markdown>
                </h3>
                <div className="text-muted-foreground text-sm">
                  <Markdown animated>{step.description}</Markdown>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!message.isStreaming && interruptMessage?.options?.length && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            {interruptMessage?.options.map((option) => (
              <Button
                key={option.value}
                variant={option.value === "accepted" ? "default" : "outline"}
                disabled={!waitForFeedback}
                onClick={() => {
                  if (option.value === "accepted") {
                    void handleAccept();
                  } else {
                    onFeedback?.({
                      option,
                    });
                  }
                }}
              >
                {option.text}
              </Button>
            ))}
          </motion.div>
        )}
      </CardFooter>
    </Card>
  );
}

function PodcastCard({
  className,
  message,
}: {
  className?: string;
  message: Message;
}) {
  const data = useMemo(() => {
    return JSON.parse(message.content ?? "");
  }, [message.content]);
  const title = useMemo<string | undefined>(() => data?.title, [data]);
  const audioUrl = useMemo<string | undefined>(() => data?.audioUrl, [data]);
  const isGenerating = useMemo(() => {
    return message.isStreaming;
  }, [message.isStreaming]);
  const hasError = useMemo(() => {
    return data?.error !== undefined;
  }, [data]);
  const [isPlaying, setIsPlaying] = useState(false);
  return (
    <Card className={cn("w-[508px]", className)}>
      <CardHeader>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isGenerating ? <LoadingOutlined /> : <Headphones size={16} />}
            {!hasError ? (
              <RainbowText animated={isGenerating}>
                {isGenerating
                  ? "Generating podcast..."
                  : isPlaying
                    ? "Now playing podcast..."
                    : "Podcast"}
              </RainbowText>
            ) : (
              <div className="text-red-500">
                Error when generating podcast. Please try again.
              </div>
            )}
          </div>
          {!hasError && !isGenerating && (
            <div className="flex">
              <Tooltip title="Download podcast">
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={audioUrl}
                    download={`${(title ?? "podcast").replaceAll(" ", "-")}.mp3`}
                  >
                    <Download size={16} />
                  </a>
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
        <CardTitle>
          <div className="text-lg font-medium">
            <RainbowText animated={isGenerating}>{title}</RainbowText>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {audioUrl ? (
          <audio
            className="w-full"
            src={audioUrl}
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full"></div>
        )}
      </CardContent>
    </Card>
  );
}

function OutlineCard({
  className,
  message,
  interruptMessage,
  onFeedback,
  waitForFeedback,
  onSendMessage,
}: {
  className?: string;
  message: Message;
  interruptMessage?: Message | null;
  onFeedback?: (feedback: { option: Option }) => void;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string },
  ) => void;
  waitForFeedback?: boolean;
}) {
  const outline = useMemo<{
    title?: string;
    abstract?: string;
    totalWords?: string;
    sections?: { sectionTitle?: string; sectionSummary?: string; detailedWords?: string }[];
  }>(() => {
    return parseJSON(message.content ?? "", {});
  }, [message.content]);

  const handleAcceptOutline = useCallback(async () => {
    if (onSendMessage) {
      onSendMessage(
        "Perfect! Let's proceed with writing the paper based on this outline.",
        {
          interruptFeedback: "ACCEPTED",
        },
      );
    }
  }, [onSendMessage]);

  const isGenerating = useMemo(() => {
    return message.isStreaming;
  }, [message.isStreaming]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isGenerating ? <LoadingOutlined /> : <FileText size={16} />}
            <RainbowText animated={isGenerating}>
              {isGenerating ? "Generating outline..." : "Paper Outline"}
            </RainbowText>
          </div>
        </div>
        <CardTitle>
          <Markdown animated>
            {`### ${outline.title ?? "Academic Paper Outline"}`}
          </Markdown>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {outline.abstract && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Abstract</h4>
            <Markdown className="opacity-80 text-sm" animated>
              {outline.abstract}
            </Markdown>
          </div>
        )}
        {outline.totalWords && (
          <div className="mb-4">
            <span className="text-sm text-muted-foreground">
              Expected Length: {outline.totalWords} words
            </span>
          </div>
        )}
        {outline.sections && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sections</h4>
            <ul className="space-y-3 border-l-[2px] pl-4">
              {outline.sections.map((section, i) => (
                <li key={`section-${i}`}>
                  <h5 className="font-medium text-sm">
                    <Markdown animated>{section.sectionTitle}</Markdown>
                  </h5>
                  {section.sectionSummary && (
                    <div className="text-muted-foreground text-xs mt-1">
                      <Markdown animated>{section.sectionSummary}</Markdown>
                    </div>
                  )}
                  {section.detailedWords && (
                    <div className="text-muted-foreground text-xs mt-1">
                      Target: {section.detailedWords} words
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!message.isStreaming && interruptMessage?.options?.length && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            {interruptMessage?.options.map((option) => (
              <Button
                key={option.value}
                variant={option.value === "accepted" ? "default" : "outline"}
                disabled={!waitForFeedback}
                onClick={() => {
                  if (option.value === "accepted") {
                    void handleAcceptOutline();
                  } else {
                    onFeedback?.({
                      option,
                    });
                  }
                }}
              >
                {option.text}
              </Button>
            ))}
          </motion.div>
        )}
      </CardFooter>
    </Card>
  );
}

function PaperWritingCard({
  className,
  message,
}: {
  className?: string;
  message: Message;
}) {
  const sectionData = useMemo<{
    section_content?: string;
    citations?: { number?: number; title?: string; url?: string; description?: string }[];
    quotes?: { text?: string; citation?: string }[];
  }>(() => {
    return parseJSON(message.content ?? "", {});
  }, [message.content]);

  const isGenerating = useMemo(() => {
    return message.isStreaming;
  }, [message.isStreaming]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {isGenerating ? <LoadingOutlined /> : <Edit3 size={16} />}
          <RainbowText animated={isGenerating}>
            {isGenerating ? "Writing paper section..." : "Paper Section"}
          </RainbowText>
        </div>
      </CardHeader>
      <CardContent>
        {sectionData.section_content && (
          <div className="prose prose-sm max-w-none">
            <Markdown animated>{sectionData.section_content}</Markdown>
          </div>
        )}
        {sectionData.citations && sectionData.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Citations</h4>
            <ul className="space-y-2">
              {sectionData.citations.map((citation, i) => (
                <li key={`citation-${i}`} className="text-xs text-muted-foreground">
                  <span className="font-medium">[{citation.number}]</span> {citation.title}
                  {citation.url && (
                    <a 
                      href={citation.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-500 hover:text-blue-700 underline"
                    >
                      Link
                    </a>
                  )}
                  {citation.description && (
                    <div className="mt-1 text-xs opacity-75">
                      {citation.description}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Fallback for old quotes format */}
        {!sectionData.citations && sectionData.quotes && sectionData.quotes.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Citations</h4>
            <ul className="space-y-1">
              {sectionData.quotes.map((quote, i) => (
                <li key={`quote-${i}`} className="text-xs text-muted-foreground">
                  {quote.citation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinalPaperCard({
  className,
  message,
}: {
  className?: string;
  message: Message;
}) {
  const isGenerating = useMemo(() => {
    return message.isStreaming;
  }, [message.isStreaming]);

  const paperData = useMemo(() => {
    try {
      return parseJSON(message.content ?? "", {}) as {
        title?: string;
        content?: string;
        status?: string;
        paper_writing_mode?: boolean;
      };
    } catch {
      return { title: "Final Report", content: message.content ?? "" };
    }
  }, [message.content]);

  const handleDownload = useCallback(() => {
    const content = paperData.content ?? message.content ?? "";
    const title = paperData.title ?? "Final_Report";
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [paperData, message.content]);

  const hasContent = useMemo(() => {
    return !!(paperData.content?.trim() ?? message.content?.trim());
  }, [paperData.content, message.content]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {isGenerating ? <LoadingOutlined /> : <FileText size={16} />}
          <RainbowText animated={isGenerating}>
            {isGenerating ? "Generating Final Report..." : (paperData.title ?? "Final Report")}
          </RainbowText>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          <Markdown animated checkLinkCredibility>
            {paperData.content ?? message.content ?? ""}
          </Markdown>
        </div>
        {message.isStreaming && <LoadingAnimation className="my-4" />}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!isGenerating && hasContent && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Download Report
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function ReporterCard({
  className,
  message,
}: {
  className?: string;
  message: Message;
}) {
  const isGenerating = useMemo(() => {
    return message.isStreaming;
  }, [message.isStreaming]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {isGenerating ? <LoadingOutlined /> : <FileText size={16} />}
          <RainbowText animated={isGenerating}>
            {isGenerating ? "Generating Final Report..." : "Final Report"}
          </RainbowText>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          <Markdown animated checkLinkCredibility>
            {message.content}
          </Markdown>
        </div>
        {message.isStreaming && <LoadingAnimation className="my-4" />}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!isGenerating && message.content && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([message.content], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'Final_Report.md';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Download Report
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
