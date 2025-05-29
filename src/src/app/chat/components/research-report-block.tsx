// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { useCallback, useRef } from "react";

import { LoadingAnimation } from "~/components/deer-flow/loading-animation";
import { Markdown } from "~/components/deer-flow/markdown";
import ReportEditor from "~/components/editor";
import { useReplay } from "~/core/replay";
import { useMessage, useStore, useFinalPaper } from "~/core/store";
import { cn } from "~/lib/utils";

import { FinalPaperBlock } from "./final-paper-block";

export function ResearchReportBlock({
  className,
  messageId,
  editing,
}: {
  className?: string;
  researchId: string;
  messageId: string;
  editing: boolean;
}) {
  const message = useMessage(messageId);
  const finalPaper = useFinalPaper();
  const { isReplay } = useReplay();
  
  // Check if this is a paper writing workflow by looking for paper_writer messages
  const isPaperWritingWorkflow = Array.from(useStore.getState().messages.values())
    .some(msg => msg.agent === "paper_writer" || msg.agent === "outline_writer");
  
  // Debug logging
  console.log("🔍 ResearchReportBlock render:", {
    messageId,
    isPaperWritingWorkflow,
    hasFinalPaper: !!finalPaper,
    finalPaperContent: finalPaper?.final_paper ? `${finalPaper.final_paper.length} chars` : 'none',
    messageAgent: message?.agent,
    messageContent: message?.content ? `${message.content.length} chars` : 'none'
  });
  
  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      if (message) {
        message.content = markdown;
        useStore.setState({
          messages: new Map(useStore.getState().messages).set(
            message.id,
            message,
          ),
        });
      }
    },
    [message],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const isCompleted = message?.isStreaming === false && message?.content !== "";
  
  // If this is a paper writing workflow and we have a final paper, show the final paper component
  if (isPaperWritingWorkflow && finalPaper) {
    console.log("✅ Rendering FinalPaperBlock");
    return (
      <FinalPaperBlock
        className={className}
        editing={editing}
      />
    );
  }
  
  console.log("📄 Rendering standard report content");
  
  // TODO: scroll to top when completed, but it's not working
  // useEffect(() => {
  //   if (isCompleted && contentRef.current) {
  //     setTimeout(() => {
  //       contentRef
  //         .current!.closest("[data-radix-scroll-area-viewport]")
  //         ?.scrollTo({
  //           top: 0,
  //           behavior: "smooth",
  //         });
  //     }, 500);
  //   }
  // }, [isCompleted]);

  return (
    <div
      ref={contentRef}
      className={cn("relative flex flex-col pt-4 pb-8", className)}
    >
      {!isReplay && isCompleted && editing ? (
        <ReportEditor
          content={message?.content}
          onMarkdownChange={handleMarkdownChange}
        />
      ) : (
        <>
          <Markdown animated checkLinkCredibility>
            {message?.content}
          </Markdown>
          {message?.isStreaming && <LoadingAnimation className="my-12" />}
        </>
      )}
    </div>
  );
}
