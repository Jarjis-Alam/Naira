import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listInterviewHistory } from "@/server/interview-coach";
import { getPlacementTargetStrategy } from "@/server/placement-target-strategy";
import { InterviewCoachView } from "@/components/interview/interview-coach-view";

export default async function InterviewCoachPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  // Load target roles
  let targetRoles: { id: string; name: string }[] = [];
  try {
    const targetStrategy = await getPlacementTargetStrategy(userId);
    if (targetStrategy?.target?.primaryRole) {
      targetRoles = [
        {
          id: targetStrategy.target.primaryRole.id,
          name: targetStrategy.target.primaryRole.name,
        },
      ];
    }
  } catch {
    // Fallback if no target configured
  }

  if (targetRoles.length === 0) {
    targetRoles = [
      { id: "default-swe", name: "Software Engineer" },
      { id: "default-frontend", name: "Frontend Engineer" },
      { id: "default-backend", name: "Backend Engineer" },
      { id: "default-fullstack", name: "Full Stack Engineer" },
    ];
  }

  // Load past interview history
  const history = await listInterviewHistory(userId);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <InterviewCoachView
        initialHistory={history}
        targetRoles={targetRoles}
      />
    </div>
  );
}
