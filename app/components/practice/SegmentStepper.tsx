"use client";

import { cn } from "@/lib/utils";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperTrigger,
} from "@/components/reui/stepper";
import { CheckIcon, MicIcon } from "lucide-react";

interface Segment {
  speaker?: string;
}

interface SegmentStepperProps {
  segments: Segment[];
  recorded: boolean[];
  currentIndex: number;
}

export function SegmentStepper({ segments, recorded, currentIndex }: SegmentStepperProps) {
  // 1-indexed; points to the segment being worked on
  const activeStep = currentIndex + 1;

  return (
    <div className="flex flex-col overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Segments
      </p>
      <Stepper
        value={activeStep}
        indicators={{
          completed: <CheckIcon className="size-3" />,
          active: <MicIcon className="size-3" />
        }}
      >
        {segments.map((seg, i) => {
          const step = i + 1;
          const isCompleted = recorded[i] ?? false;
          const isActive = step === activeStep && !isCompleted;

          return (
            <StepperItem
              key={i}
              step={step}
              completed={isCompleted}
              loading={isActive}
              className="!flex-none w-full items-start justify-start"
            >
              <div className="flex items-start gap-1">
                {/* Indicator + connecting line */}
                <div className="flex flex-col items-center">
                  <StepperTrigger asChild>
                    <StepperIndicator
                      className={cn(
                        "size-6 shrink-0 border-2 text-[10px] font-semibold",
                        "data-[state=completed]:bg-success data-[state=completed]:text-white data-[state=completed]:border-success",
                        "data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white",
                        "data-[state=inactive]:bg-transparent data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground",
                      )}
                    >
                      {!isCompleted && !isActive && step}
                    </StepperIndicator>
                  </StepperTrigger>
                  {i < segments.length - 1 && (
                    <div
                      className={cn(
                        "w-px flex-1 min-h-[20px] my-0.5",
                        isCompleted ? "bg-success/40" : "bg-border",
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <div className={cn("flex flex-col gap-0.5 pt-0.5", i < segments.length - 1 && "pb-2")}>
                  <span
                    className={cn(
                      "text-sm font-semibold leading-none",
                      isCompleted
                        ? "text-success"
                        : isActive
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    Segment {step}
                  </span>
                  {seg.speaker && (
                    <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {seg.speaker}
                    </span>
                  )}
                </div>
              </div>
            </StepperItem>
          );
        })}
      </Stepper>
    </div>
  );
}
