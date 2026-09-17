import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveStudyPlan } from "@/server/adaptive-study-planner";
import { StudyPlannerView } from "@/components/planner/study-planner-view";

export const metadata = {
  title: "Adaptive Study Planner | Nexora",
  description:
    "Evidence-calibrated preparation schedule, personalized time budgeting, and adaptive reassessment.",
};

export default async function PlannerPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/planner");
  }

  const plan = await getActiveStudyPlan(session.user.id);

  return <StudyPlannerView initialPlan={plan} />;
}
