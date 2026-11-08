"use client";

/* eslint-disable @next/next/no-img-element -- remote CDN photos; next/image would proxy them through our server */
import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { exerciseImage } from "@/lib/gym/groups";
import { cn } from "./ui";

/** Looping exercise demo: crossfades between the start and end position photos. */
export function ExerciseAnim({
  id,
  name,
  img,
  animate = true,
  className,
}: {
  id: string;
  name: string;
  img: boolean;
  animate?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!img || failed) {
    return (
      <div className={cn("flex aspect-[4/3] items-center justify-center rounded-xl bg-surface-2 text-text-3", className)}>
        <Dumbbell className="size-1/4" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-white", className)}>
      <img
        src={exerciseImage(id, 0)}
        alt={`${name} demonstration`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-contain"
      />
      {animate && (
        <img
          src={exerciseImage(id, 1)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="exercise-frame-2 absolute inset-0 size-full object-contain opacity-0"
        />
      )}
    </div>
  );
}
