// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { useCallback, useRef } from "react";

import { LoadingAnimation } from "~/components/deer-flow/loading-animation";
import { Markdown } from "~/components/deer-flow/markdown";
import ReportEditor from "~/components/editor";
import { useReplay } from "~/core/replay";
import { useFinalPaper, useFinalPaperLoading, useFinalPaperError, useStore } from "~/core/store";
import { cn } from "~/lib/utils";

export function FinalPaperBlock({
  className,
  editing,
}: {
  className?: string;
  editing: boolean;
}) {
  const finalPaper = useFinalPaper();
  const loading = useFinalPaperLoading();
  const error = useFinalPaperError();
  const { isReplay } = useReplay();
  
  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      if (finalPaper) {
        // Update the final paper content in the store
        useStore.setState({
          finalPaper: {
            ...finalPaper,
            final_paper: markdown,
          },
        });
      }
    },
    [finalPaper],
  );
  
  const contentRef = useRef<HTMLDivElement>(null);
  const isCompleted = !loading && finalPaper?.final_paper && !error;

  if (loading) {
    return (
      <div className={cn("relative flex flex-col pt-4 pb-8", className)}>
        <div className="text-center">
          <LoadingAnimation className="my-12" />
          <p className="text-sm text-muted-foreground">Loading final paper...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("relative flex flex-col pt-4 pb-8", className)}>
        <div className="text-center text-red-500">
          <p className="text-sm">Error loading final paper: {error}</p>
        </div>
      </div>
    );
  }

  if (!finalPaper?.final_paper) {
    return (
      <div className={cn("relative flex flex-col pt-4 pb-8", className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No final paper available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className={cn("relative flex flex-col pt-4 pb-8", className)}
    >
      {!isReplay && isCompleted && editing ? (
        <ReportEditor
          content={finalPaper.final_paper}
          onMarkdownChange={handleMarkdownChange}
        />
      ) : (
        <>
          <Markdown animated checkLinkCredibility>
            {finalPaper.final_paper}
          </Markdown>
        </>
      )}
    </div>
  );
} 