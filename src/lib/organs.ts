import type { OrganId } from "@/types/organ";

export type OrganConfig = {
  id: OrganId;
  label: string;
  role: string;
  facts: [string, string, string];
  meshNames: string[];
};

export const MODEL_URL =
  "/models/female_health_model (1).glb";

export const ORGANS: Record<OrganId, OrganConfig> = {
  uterus: {
    id: "uterus",
    label: "Uterus",
    role: "The uterus supports menstrual changes and can carry a pregnancy.",
    facts: [
      "Its muscular walls change across the menstrual cycle.",
      "The lining can thicken and later shed during menstruation.",
      "It expands as part of pregnancy to accommodate a developing baby.",
    ],
    meshNames: ["organ_uterus"],
  },
  heart: {
    id: "heart",
    label: "Heart",
    role: "The heart pumps blood through the body to deliver oxygen and nutrients.",
    facts: [
      "It beats continuously to circulate blood.",
      "The right and left sides send blood to the lungs and body.",
      "A healthy routine supports overall cardiovascular wellbeing.",
    ],
    meshNames: ["organ_heart"],
  },
  brain: {
    id: "brain",
    label: "Brain",
    role: "The brain coordinates body functions and helps process hormones and feelings.",
    facts: [
      "It receives signals from throughout the body.",
      "It helps regulate sleep, movement, sensation, and emotions.",
      "Hormonal signals are interpreted alongside many other body signals.",
    ],
    meshNames: ["organ_brain"],
  },
};
