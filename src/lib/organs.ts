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
  breasts: {
    id: "breasts",
    label: "Breasts",
    role: "The breasts contain glandular tissue that changes across life stages and can produce milk.",
    facts: [
      "Breast tissue is made of glandular, fatty, and connective tissue.",
      "Hormones can cause temporary monthly tenderness or size changes.",
      "Milk-producing glands are supported by ducts that drain at the nipple.",
    ],
    meshNames: ["organ_breasts", "organ_breast_left", "organ_breast_right"],
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
  ovaries: {
    id: "ovaries",
    label: "Ovaries",
    role: "The ovaries store eggs and release hormones involved in the menstrual cycle.",
    facts: [
      "Ovaries release estrogen and progesterone.",
      "Typically, one ovary may release an egg during a menstrual cycle.",
      "Egg and hormone production naturally change over a person's lifespan.",
    ],
    meshNames: ["organ_ovaries", "organ_ovary_left", "organ_ovary_right"],
  },
  thyroid: {
    id: "thyroid",
    label: "Thyroid",
    role: "The thyroid makes hormones that help regulate metabolism and energy use.",
    facts: [
      "It is located in the front of the neck.",
      "Thyroid hormones influence metabolism and body temperature.",
      "Iodine is needed as part of normal thyroid hormone production.",
    ],
    meshNames: ["organ_thyroid"],
  },
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
};
