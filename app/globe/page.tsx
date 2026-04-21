import { GlobeInteractive } from "@/widgets/Gobe/GlobeInteractive";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 500 }}>
        <GlobeInteractive />
      </div>
    </div>
  )
}