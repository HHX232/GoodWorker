import { GlobeInteractive } from "@/widgets/Gobe/GlobeInteractive";

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Globe' }
}



export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 500 }}>
        <GlobeInteractive />
      </div>
    </div>
  )
}