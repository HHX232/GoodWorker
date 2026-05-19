import { redirect } from "next/navigation"
import { auth } from "../../auth"

export default async function ProfileProxy() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "STUDENT") {
    redirect("/student-profile")
  }

  redirect("/teacher-profile")
}