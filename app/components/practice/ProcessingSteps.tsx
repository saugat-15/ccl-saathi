"use client";

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import { Badge } from "@/components/reui/badge";
import {
  CheckIcon,
  LoaderCircleIcon,
  UploadIcon,
  MicIcon,
  BarChart2Icon,
  SparklesIcon,
} from "lucide-react";

const STEPS = [
  { title: "Uploaded", icon: <UploadIcon className="size-4" /> },
  { title: "Transcribing", icon: <MicIcon className="size-4" /> },
  { title: "Scoring", icon: <BarChart2Icon className="size-4" /> },
  { title: "Ready", icon: <SparklesIcon className="size-4" /> },
];

interface ProcessingStepsProps {
  /** 1-indexed active step. 1 = Uploaded, 2 = Transcribing, 3 = Scoring, 4 = Ready */
  activeStep?: number;
}

export function ProcessingSteps({ activeStep = 2 }: ProcessingStepsProps) {
  return (
    <Stepper
      value={activeStep}
      indicators={{
        completed: <CheckIcon className="size-3.5" />,
        loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
      }}
      className="w-full"
    >
      <StepperNav className="gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === activeStep;
          return (
            <StepperItem
              key={step.title}
              step={stepNumber}
              loading={isActive}
              className="relative flex-1 items-start"
            >
              <StepperTrigger
                className="flex grow flex-col items-start gap-2"
                asChild
              >
                <StepperIndicator className="data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground data-[state=completed]:[background:var(--progress-fill)] data-[state=completed]:[border-color:var(--progress-fill)] data-[state=inactive]:bg-transparent size-8 border-2 data-[state=completed]:text-white">
                  {step.icon}
                </StepperIndicator>
                <StepperTitle className="group-data-[state=inactive]/step:text-muted-foreground text-sm font-semibold">
                  {step.title}
                </StepperTitle>
                <Badge
                  size="sm"
                  variant="primary-light"
                  className="hidden group-data-[state=active]/step:inline-flex p-1"
                >
                  In progress
                </Badge>
                <Badge
                  variant="success-light"
                  size="sm"
                  className="hidden group-data-[state=completed]/step:inline-flex"
                >
                  Done
                </Badge>
              </StepperTrigger>

              {index < STEPS.length - 1 && (
                <StepperSeparator className="group-data-[state=completed]/step:[background:var(--progress-fill)] absolute inset-x-0 start-9 top-4 m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none" />
              )}
            </StepperItem>
          );
        })}
      </StepperNav>
    </Stepper>
  );
}
