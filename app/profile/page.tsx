import { redirect } from "next/navigation"
import { auth } from "../../auth"

export default async function ProfileProxy() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "TEACHER") {
    redirect("/teacher-profile")
  }

  redirect("/student-profile")
}