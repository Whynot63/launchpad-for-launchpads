"use client";

import { launchpadDomain } from "@/lib/config";
import { type LaunchpadMetadata, slugFromName } from "@/lib/metadata";
import { Field, Input, Textarea } from "./ui";

export type BrandingForm = Omit<LaunchpadMetadata, "address">;

export const EMPTY_BRANDING: BrandingForm = { slug: "", name: "", description: "", logoUrl: "", accentColor: "#9CD6FF" };

export function BrandingFields({
  value,
  onChange,
  deriveSlugFromName,
}: {
  value: BrandingForm;
  onChange: (value: BrandingForm) => void;
  deriveSlugFromName: boolean;
}) {
  const set = (patch: Partial<BrandingForm>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Name">
        <Input
          required
          maxLength={50}
          placeholder="AI Agents"
          value={value.name}
          onChange={(event) =>
            set({ name: event.target.value, ...(deriveSlugFromName && { slug: slugFromName(event.target.value) }) })
          }
        />
      </Field>
      <Field label="Subdomain" hint={`${value.slug || "your-name"}.${launchpadDomain}`}>
        <Input
          required
          maxLength={32}
          placeholder="ai"
          value={value.slug}
          onChange={(event) => set({ slug: event.target.value.toLowerCase() })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" hint="Optional. Shown on the launchpad home page.">
          <Textarea
            maxLength={280}
            placeholder="Tokens for autonomous agents."
            value={value.description}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Logo URL" hint="Optional. An https link to a square image.">
        <Input
          type="url"
          placeholder="https://…"
          value={value.logoUrl}
          onChange={(event) => set({ logoUrl: event.target.value })}
        />
      </Field>
      <Field label="Accent Color">
        <Input
          type="color"
          className="cursor-pointer px-1"
          value={value.accentColor}
          onChange={(event) => set({ accentColor: event.target.value })}
        />
      </Field>
    </div>
  );
}
