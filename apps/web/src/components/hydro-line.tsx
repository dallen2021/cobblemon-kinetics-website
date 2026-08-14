"use client";

import { useEffect, useRef, useState } from "react";
import { RegistryId } from "@/components/ui";

const steps = [
  {
    number: "01",
    label: "Assign",
    title: "A worker enters the line",
    copy: "A structured profile connects one eligible Water-type worker to one deliberate workstation.",
  },
  {
    number: "02",
    label: "Transfer",
    title: "Flow becomes rotation",
    copy: "The Hydro Coupler validates ownership and state before handing controlled power to the kinetic network.",
  },
  {
    number: "03",
    label: "Review",
    title: "A record reaches the workshop",
    copy: "Balance, behavior, and implementation evidence move through revision history before Git publication.",
  },
] as const;

const workflowNodes = [
  { label: "Worker record", id: "cobblemon:squirtle" },
  { label: "Validated profile", id: "cobblemon_kinetics:hydro_operator" },
  { label: "Review revision", id: "publication:pending" },
] as const;

export function HydroLine() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.step ?? 0));
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0.15, 0.5, 0.85] },
    );
    for (const element of stepRefs.current) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hydro-line" aria-labelledby="hydro-line-title">
      <div className="hydro-stage" data-active={active}>
        <div className="stage-label">
          <span>Prototype line</span>
          <strong id="hydro-line-title">Hydro transfer sequence</strong>
        </div>
        <ol className="workflow-board" aria-label="Hydro profile publication flow">
          {workflowNodes.map((node, index) => (
            <li
              className={`workflow-node${index <= active ? " workflow-node-active" : ""}`}
              key={node.id}
            >
              <span>{node.label}</span>
              <RegistryId>{node.id}</RegistryId>
              {index < workflowNodes.length - 1 ? (
                <span className="workflow-arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="stage-meter" aria-hidden="true">
          {steps.map((step, index) => (
            <span className={index <= active ? "meter-active" : ""} key={step.number} />
          ))}
        </div>
      </div>
      <ol className="hydro-steps">
        {steps.map((step, index) => (
          <li
            className={active === index ? "hydro-step-active" : ""}
            data-step={index}
            key={step.number}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
          >
            <span className="step-number">
              {step.number} · {step.label}
            </span>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
