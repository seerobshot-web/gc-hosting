export type AudienceId =
  | "church"
  | "ministry"
  | "nonprofit"
  | "coach"
  | "creator"
  | "christian-business";

export interface AudienceJourney {
  id: AudienceId;
  code: string;
  label: string;
  statement: string;
  cta: string;
  href: string;
  scene: string;
  mediaBrief: string;
}

export const audienceJourneys: AudienceJourney[] = [
  {
    id: "church",
    code: "AUD-01",
    label: "Church",
    statement:
      "Bring your website, livestream, events, giving and next steps into a more connected digital experience.",
    cta: "Explore church technology",
    href: "/ministry",
    scene: "church",
    mediaBrief:
      "Three-quarter rear or side POV behind a livestream camera; rig in foreground, worship leader midground, congregation and stage lighting behind.",
  },
  {
    id: "ministry",
    code: "AUD-02",
    label: "Ministry",
    statement:
      "Give people clear ways to discover your ministry, receive resources and stay connected beyond the gathering.",
    cta: "Build a connected ministry presence",
    href: "/ministry",
    scene: "ministry",
    mediaBrief:
      "Shoulder-level documentary table scene with open Bibles, notebooks and genuine discussion or prayer; technology secondary.",
  },
  {
    id: "nonprofit",
    code: "AUD-03",
    label: "Nonprofit",
    statement:
      "Bring programs, outreach, resources and calls to action together without making your team manage disconnected systems.",
    cta: "Explore nonprofit solutions",
    href: "/marketing",
    scene: "nonprofit",
    mediaBrief:
      "Working session with program materials foreground, collaborative meeting midground and real service/community environment behind.",
  },
  {
    id: "coach",
    code: "AUD-04",
    label: "Coach",
    statement:
      "Build a professional home for your expertise, scheduling, resources and client journey.",
    cta: "Build my coaching platform",
    href: "/marketing",
    scene: "coach",
    mediaBrief:
      "Over-the-shoulder strategy session with notebook or tablet foreground and coach/client interaction midground.",
  },
  {
    id: "creator",
    code: "AUD-05",
    label: "Creator",
    statement:
      "Connect your content, audience, offers and digital tools without scattering your community across unrelated platforms.",
    cta: "Explore creator tools",
    href: "/tools",
    scene: "creator",
    mediaBrief:
      "Content-production environment with camera, microphone or light edge foreground and creator/control surface midground.",
  },
  {
    id: "christian-business",
    code: "AUD-06",
    label: "Christian Business",
    statement:
      "Present your business professionally, get found online and connect the digital systems behind customer growth.",
    cta: "Grow my business online",
    href: "/marketing",
    scene: "christian-business",
    mediaBrief:
      "Real operational meeting or active business environment with owner/leader working, subtle technology layer and visible workplace context.",
  },
];
