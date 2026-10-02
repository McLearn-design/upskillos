export default {
  label: "HTML Lab",
  emoji: "🏗️",
  color: "orange",
  kind: "builder",
  subject: "Web Dev",
  desc: "Drag, drop, and style real HTML elements on a live canvas — div, p, h1, button, span, and more. Edit inline CSS through a properties panel, watch the code panel sync both ways, and see the box model visualized live.",
  path: "/html-lab",
  tags: ["HTML", "CSS", "Web", "Interactive"],
  cover: {
    grad: "from-orange-600 via-amber-700 to-yellow-950",
    mark: "</>",
    sub: "Elements · Box Model · CSS"
  },
  order: 7,
  // Three panes (elements, canvas, properties) need more than the default
  // 960×640 window; the desktop clamps this to the screen.
  width: 1440,
  height: 900,
}
